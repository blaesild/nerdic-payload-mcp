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

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
const envResult = dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (envResult.error) {
  console.error("Error loading .env file:", envResult.error);
  process.exit(1); // Exit if we can't load environment variables
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
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
} as cors.CorsOptions;

app.use(cors(corsOptions));

// Body Parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ----- MCP SERVER WITH SSE TRANSPORT -----
// Store transports by sessionId to support multiple connections
const transports: { [sessionId: string]: SSEServerTransport } = {};

// SSE endpoint
app.get("/sse", async (req: Request, res: Response) => {
  console.log("[DEBUG] New SSE connection received");
  try {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    // Log the session ID for debugging
    console.log(`[DEBUG] Created SSE transport with sessionId: ${transport.sessionId}`);
    
    // Handle client disconnect
    res.on("close", () => {
      console.log(`[DEBUG] Client disconnected: ${transport.sessionId}`);
      delete transports[transport.sessionId];
    });
    
    // Connect the transport to our MCP server
    await mcpServer.connect(transport);
    console.log(`[DEBUG] MCP server connected to transport: ${transport.sessionId}`);
  } catch (error) {
    console.error('[ERROR] Error setting up SSE connection:', error);
    res.status(500).send('Error setting up SSE connection');
  }
});

// Message endpoint for client-to-server communication
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[DEBUG] Received message for session ${sessionId}`);
  
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    console.error(`[ERROR] No transport found for sessionId: ${sessionId}`);
    res.status(400).send('No transport found for sessionId');
  }
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
    transports: Object.keys(transports)
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
