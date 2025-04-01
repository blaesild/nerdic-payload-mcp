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

// Debug middleware to log all requests with more detail
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  console.log(`[DEBUG] Headers:`, JSON.stringify(req.headers));
  console.log(`[DEBUG] Body:`, req.body);
  console.log(`[DEBUG] Query:`, req.query);
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

// Body Parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ----- MCP SERVER WITH ENHANCED SSE TRANSPORT -----

// SSE endpoint with enhanced connection handling
app.get("/sse", async (req: Request, res: Response) => {
  console.log("[DEBUG] New SSE connection received");
  try {
    const transport = new SSEServerTransport('/messages', res);
    
    // Add connection to manager
    const connectionInfo = connectionManager.addConnection(transport, res);
    
    // Connect the transport to our MCP server
    await mcpServer.connect(transport);
    console.log(`[DEBUG] MCP server connected to transport: ${transport.sessionId}`);
    
    // Send initial connection event after MCP connection is established
    // This ensures we don't have header conflicts
    res.write(`data: ${JSON.stringify({ 
      type: 'connection', 
      status: 'established', 
      sessionId: transport.sessionId 
    })}\n\n`);
  } catch (error) {
    console.error('[ERROR] Error setting up SSE connection:', error);
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).send('Error setting up SSE connection');
    }
  }
});

// Enhanced message endpoint with reliability features
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[DEBUG] Received message for session ${sessionId}`);
  
  // Handle message acknowledgment
  if (req.query.ack === 'true' && req.query.messageId) {
    const messageId = req.query.messageId as string;
    const ackSuccess = messageQueue.acknowledge(messageId);
    return res.status(200).json({ acknowledged: ackSuccess, messageId });
  }
  
  // Handle reconnection and pending messages delivery
  if (req.query.reconnect === 'true') {
    const pendingMessages = messageQueue.getUnacknowledgedMessages(sessionId);
    
    if (pendingMessages.length > 0) {
      console.log(`[DEBUG] Sending ${pendingMessages.length} pending messages for reconnected client ${sessionId}`);
      return res.status(200).json({ 
        status: 'reconnected',
        pendingMessages: pendingMessages.map(m => ({ 
          messageId: m.id, 
          payload: m.payload,
          timestamp: m.timestamp
        }))
      });
    }
    
    return res.status(200).json({ status: 'reconnected', pendingMessages: [] });
  }
  
  // Regular message handling
  const connection = connectionManager.getConnection(sessionId);
  if (connection?.transport) {
    try {
      // Update last active timestamp
      connectionManager.updateActivity(sessionId);
      
      // Get client message ID if provided
      const clientMsgId = req.headers['x-client-message-id'] as string;
      
      // Queue the message for reliability
      const queuedMessageId = messageQueue.enqueue(sessionId, req.body);
      
      // Process the message via the transport
      // Set the message ID header before transport processes the request
      res.setHeader('X-Message-Id', queuedMessageId);
      
      await connection.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error(`[ERROR] Error processing message for ${sessionId}:`, error);
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error processing message', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  } else {
    console.error(`[ERROR] No transport found for sessionId: ${sessionId}`);
    res.status(404).json({ 
      error: 'No active connection', 
      message: `No transport found for sessionId: ${sessionId}` 
    });
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
