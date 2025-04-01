import dotenv from "dotenv"; // Use import for ESM
import path from "path";
import { fileURLToPath } from "url";
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import mcpServer from "./core/mcp-server.js";
import apiRouter from "./api/index.js"; // Main API router
import { errorHandler } from "./api/middleware/errorHandler.js"; // Error handler
import { initializeOpenAI } from "./core/generation.js";
import { connectionManager } from "./core/messaging/connection-manager.js";
import { messageQueue } from "./core/messaging/message-queue.js";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
const envPath = path.resolve(__dirname, "../.env");
console.log(`Attempting to load .env file from: ${envPath}`);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error("Error loading .env file:", envResult.error);
  process.exit(1); // Exit if we can't load environment variables
} else {
  console.log("Loaded .env file successfully");
  console.log("Environment variables:", Object.keys(process.env).filter(key => 
    !key.startsWith('npm_') && 
    key !== 'PATH' && 
    key !== 'HOME').map(key => `${key}=${key === 'OPENAI_API_KEY' ? 'sk-...' : process.env[key]}`));
}

// Initialize environment
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required but not found in environment variables");
  process.exit(1);
}

console.log("Environment variables loaded successfully");

// Initialize OpenAI client
if (!initializeOpenAI()) {
  console.error("Failed to initialize OpenAI client");
  process.exit(1);
}

const app: Express = express();
const port = process.env.PORT || 8090;

// --- Middleware ---

// IMPORTANT: Body parsing middleware must be first, before any other middleware
// Body Parsing with enhanced error handling
app.use(express.json({ 
  limit: "5mb",
  verify: (req: any, res: Response, buf: Buffer) => {
    // Store the raw body for debugging purposes
    req.rawBody = buf.toString();
  }
}));

// Add error handling for JSON parsing errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[ERROR] JSON parsing error:', err.message);
    
    // Get content type to determine response format
    const contentType = req.headers['content-type'] || '';
    const acceptsJson = contentType.includes('application/json');
    
    // Send appropriate error format
    if (acceptsJson && req.body && req.body.jsonrpc === '2.0') {
      // JSON-RPC error response
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32700, // Parse error code in JSON-RPC
          message: 'Invalid JSON: ' + err.message
        },
        id: null // We can't know the ID since parsing failed
      });
    } else {
      // Regular error response
      return res.status(400).json({ 
        error: 'Invalid JSON',
        message: err.message
      });
    }
  }
  
  // Pass other errors through
  next(err);
});

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Log raw body for debugging
app.use((req: Request & { rawBody?: string }, res: Response, next: NextFunction) => {
  console.log(`[RAW BODY] ${req.method} ${req.url}`);
  if (req.rawBody) {
    console.log(`[RAW BODY] Content: ${req.rawBody.substring(0, 500)}${req.rawBody.length > 500 ? '...' : ''}`);
  } else {
    console.log(`[RAW BODY] No raw body available`);
  }
  next();
});

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Client-Message-Id"],
  exposedHeaders: ["X-Message-Id"],
  credentials: true
} as cors.CorsOptions;

app.use(cors(corsOptions));

// Debugging middleware for body parsing issues
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[BODY DEBUG] Path: ${req.method} ${req.url}`);
  console.log(`[BODY DEBUG] Content-Type: ${req.get('Content-Type')}`);
  console.log(`[BODY DEBUG] Content-Length: ${req.get('Content-Length')}`);
  
  // Check if body was correctly parsed
  if (req.body === undefined) {
    console.log(`[BODY DEBUG] WARNING: Body is undefined!`);
  } else if (Object.keys(req.body).length === 0) {
    console.log(`[BODY DEBUG] WARNING: Body is empty object!`);
  } else {
    console.log(`[BODY DEBUG] Body parsed successfully:`, JSON.stringify(req.body).substring(0, 500));
  }
  
  next();
});

// Debug middleware to log all requests with more detail - AFTER body parsing
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  console.log(`[DEBUG] Headers:`, JSON.stringify(req.headers));
  console.log(`[DEBUG] Body:`, req.body);
  console.log(`[DEBUG] Query:`, req.query);
  next();
});

// ----- MCP SERVER WITH ENHANCED SSE TRANSPORT -----

// Simple map to store transports by sessionId, as recommended in the MCP documentation
const transports: {[sessionId: string]: SSEServerTransport} = {};

// Enhanced SSE endpoint with better compatibility for Node.js clients
app.get("/sse", async (req: Request, res: Response) => {
  console.log("[DEBUG] New SSE connection received");
  
  // Set appropriate headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For Nginx proxy compatibility
  
  try {
    // Create a transport for this connection
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    
    // Store the transport for message routing
    transports[sessionId] = transport;
    
    // Handle cleanup when connection closes
    res.on("close", () => {
      console.log(`[DEBUG] SSE connection closed for session ${sessionId}`);
      delete transports[sessionId];
      connectionManager.cleanupConnection(sessionId);
    });
    
    // Add to our connection manager for monitoring
    connectionManager.addConnection(transport, res);
    
    // Connect the transport to our MCP server
    await mcpServer.connect(transport);
    console.log(`[DEBUG] MCP server connected to transport: ${sessionId}`);
    
    // Send initial connection event so the client knows the sessionId
    // Using format: data: {json}\n\n
    res.write(`data: ${JSON.stringify({ 
      type: 'connection',
      status: 'established', 
      sessionId: sessionId 
    })}\n\n`);
    
    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }
      
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000);
    
    // Clean up interval on connection close
    res.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  } catch (error) {
    console.error('[ERROR] Error setting up SSE connection:', error);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).send('Error setting up SSE connection');
    } else {
      res.end();
    }
  }
});

// Enhanced messages endpoint with better error handling
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[DEBUG] Received message for session ${sessionId}`);
  
  if (!sessionId) {
    console.error('[ERROR] Missing sessionId in request');
    return res.status(400).json({
      error: 'Missing sessionId',
      message: 'The sessionId query parameter is required'
    });
  }
  
  // Get the transport for this session
  const transport = transports[sessionId];
  if (!transport) {
    console.error(`[ERROR] No transport found for sessionId: ${sessionId}`);
    return res.status(404).json({ 
      error: 'No active connection', 
      message: `No transport found for sessionId: ${sessionId}` 
    });
  }
  
  try {
    // Check for valid request body
    if (!req.body || typeof req.body !== 'object') {
      console.error('[ERROR] Invalid request body format');
      return res.status(400).json({
        error: 'Invalid request format',
        message: 'Request body must be a valid JSON object'
      });
    }
    
    // Log the message for debugging
    console.log(`[DEBUG] Message for ${sessionId}:`, JSON.stringify(req.body).substring(0, 200));
    
    // Update activity timestamp
    connectionManager.updateActivity(sessionId);
    
    // Add message to queue for reliability
    const messageId = messageQueue.enqueue(sessionId, req.body);
    res.setHeader('X-Message-Id', messageId);
    
    // Get the original message
    const message = req.body;
    
    // ENHANCED HANDLING: Instead of only handling 'generate' tool directly,
    // let's apply our improved parameter extraction to all tools
    try {
      // Check if this is a JSON-RPC request calling a tool
      if (message.jsonrpc === '2.0' && message.method === 'callTool' && message.params?.name) {
        const toolName = message.params.name;
        console.log(`[DEBUG] Direct handling of ${toolName} tool request`);
        
        // Import the utility for parameter extraction
        const { extractJSONRPCParams } = await import('./core/utils.js');
        const params = extractJSONRPCParams(message);
        
        // Handle 'generate' tool
        if (toolName === 'generate') {
          const { type, options } = params;
          
          if (!type) {
            throw new Error('Missing required parameter: type');
          }
          
          // Process the generate request based on type
          let result;
          switch (type) {
            case 'field':
              if (!options || !options.name || !options.type) {
                throw new Error('Missing required field parameters: name, type');
              }
              
              // Use our regular API function to generate the field
              const { generateField } = await import('./core/generation.js');
              result = await generateField(options);
              break;
              
            case 'collection':
              if (!options || !options.slug || !options.fields) {
                throw new Error('Missing required collection parameters: slug, fields');
              }
              
              // Use our regular API function to generate the collection
              const { generateCollection } = await import('./core/generation.js');
              result = await generateCollection(options);
              break;
              
            case 'template':
              if (!options || !options.type) {
                throw new Error('Missing required template parameter: type');
              }
              
              // Use our regular API function to generate the template
              const { generateTemplate } = await import('./core/generation.js');
              result = await generateTemplate(options.type, options);
              break;
              
            case 'code':
              if (!options || !options.prompt || !options.context) {
                throw new Error('Missing required code parameters: prompt, context');
              }
              
              // Use our regular API function to generate context-aware code
              const { generateContextAwareCode } = await import('./core/generation.js');
              result = await generateContextAwareCode(options.prompt, options.context);
              break;
              
            default:
              throw new Error(`Unsupported generation type: ${type}`);
          }
          
          // Create a proper JSON-RPC response
          const response = {
            jsonrpc: '2.0',
            result,
            id: message.id
          };
          
          // Send back the HTTP response
          res.json(response);
          
          // Also write to the SSE stream for real-time updates
          const response_sse = `data: ${JSON.stringify(response)}\n\n`;
          // Safely access the underlying response object
          if (transport['res'] && typeof transport['res'].write === 'function') {
            transport['res'].write(response_sse);
          }
          
          return;
        }
        
        // For other tools, we could add direct handling here if needed
        // For now, we'll fall through to the SDK transport
      }
      
      // Try using the SDK transport, but catch any stream errors specifically
      try {
        await transport.handlePostMessage(req, res);
      } catch (transportError) {
        console.error(`[ERROR] Transport error:`, transportError);
        
        // Look for the specific "stream is not readable" error
        if (transportError instanceof Error && 
            transportError.message.includes('stream is not readable')) {
          
          // This is the known SDK issue, so we'll create a proper error response
          const streamErrorResponse = {
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'SSE transport stream error - we recommend using direct API endpoints',
              data: {
                originalError: transportError.message,
                workaround: 'Use direct API endpoints at /api/mcp/* instead of SSE transport'
              }
            },
            id: message.id || null
          };
          
          // Send HTTP response if not sent
          if (!res.headersSent) {
            res.status(500).json(streamErrorResponse);
          }
          
          // Also write to the SSE stream if possible
          const error_sse = `data: ${JSON.stringify(streamErrorResponse)}\n\n`;
          if (transport['res'] && typeof transport['res'].write === 'function') {
            transport['res'].write(error_sse);
          }
        } else {
          // For other transport errors, re-throw
          throw transportError;
        }
      }
    } catch (error) {
      console.error(`[ERROR] Error processing message:`, error);
      
      // Create error response
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error)
        },
        id: req.body.id || null
      };
      
      // Send HTTP response if not sent
      if (!res.headersSent) {
        res.status(500).json(errorResponse);
      }
      
      // Also write to the SSE stream if possible
      const error_sse = `data: ${JSON.stringify(errorResponse)}\n\n`;
      if (transport['res'] && typeof transport['res'].write === 'function') {
        transport['res'].write(error_sse);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Error in message handler for ${sessionId}:`, error);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error processing message', 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  }
});

// Connection monitoring endpoint
app.get("/connections", (req, res) => {
  res.json(connectionManager.getStats());
});

// Message queue statistics endpoint
app.get("/message-queue/stats", (req, res) => {
  res.json(messageQueue.getStats());
});

// Mount API routes
console.log('[DEBUG] Mounting API routes at /api');
app.use("/api", apiRouter);
console.log('[DEBUG] API routes mounted');

// Add a test route
app.get('/test', (req, res) => {
  console.log('[DEBUG] Test route accessed');
  res.json({ message: 'Test route works!' });
});

// Create a route that will show all available routes
app.get('/routes', (req, res) => {
  const routes: { method: string; path: string }[] = [];
  
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Route directly on the app
      const methods = Object.keys(middleware.route.methods)
        .filter((method) => middleware.route.methods[method])
        .map((method) => method.toUpperCase());
      
      routes.push({
        method: methods.join(', '),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      // Routes from Express router instances
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods)
            .filter((method) => handler.route.methods[method])
            .map((method) => method.toUpperCase());
          
          routes.push({
            method: methods.join(', '),
            path: handler.route.path
          });
        }
      });
    }
  });
  
  res.json({
    routes,
    activeConnections: connectionManager.getConnections().size
  });
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// Default route
app.get("/", (req, res) => {
  res.send("MCP Server is running!");
});

// Start server
const server = app.listen(port, () => {
  console.log(`MCP Server listening on port ${port}`);
  console.log(`CORS Origin configured for: ${corsOptions.origin}`);
  console.log('SSE endpoint available at: /sse');
  console.log('Message endpoint available at: /messages?sessionId=<id>');
  console.log('Routes endpoint available at: /routes');
  console.log('Connection monitoring endpoint available at: /connections');
  console.log('Message queue stats endpoint available at: /message-queue/stats');

  // Log all registered routes for debugging
  console.log('Registered routes:');
  app._router.stack.forEach((r: any) => {
    if (r.route && r.route.path) {
      console.log(`  ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
    } else if (r.name === 'router' && r.handle.stack) {
      r.handle.stack.forEach((nestedRoute: any) => {
        if (nestedRoute.route) {
          const method = nestedRoute.route.stack[0].method.toUpperCase();
          console.log(`  ${method} ${r.regexp} -> ${nestedRoute.route.path}`);
        }
      });
    }
  });
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

export default app;
