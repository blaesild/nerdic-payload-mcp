import { Request, Response, NextFunction } from "express";
import { isMCPContext, MCPContext } from "../../core/types";
import { 
  createJSONRPCSuccess, 
  createJSONRPCError, 
  JSONRPC_ERROR_CODES,
  extractJSONRPCParams 
} from "../../core/utils.js";

// Middleware to attach tool name for consistent responses/error handling
export function setMCPTool(toolName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.mcpTool = toolName;
    next();
  };
}

// Middleware or helper function to handle context extraction and validation
export function getContext(
  req: Request,
  requiresContext: boolean,
): { context?: MCPContext; contextWarnings: string[] } {
  const body = req.body;
  let context: MCPContext | undefined = undefined;
  const contextWarnings: string[] = [];

  // Extract parameters using our utility function
  const params = extractJSONRPCParams(body);
  
  if (params?.context) {
    if (isMCPContext(params.context)) {
      context = params.context;
    } else {
      contextWarnings.push(
        "Received context object does not match expected MCPContext structure.",
      );
      console.warn("MCP API: Invalid context object received:", params.context);
    }
  } else if (requiresContext) {
    const err = new Error(
      "MCPContext is required but was not provided in the request params.",
    ) as Error & { status: number };
    err.status = 400;
    throw err;
  }

  return { context, contextWarnings };
}

// Generic MCP request handler wrapper
export function handleMCPRequest(handler: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    try {
      console.log('[MCP REQUEST] Processing request with body:', req.body);
      
      // Ensure the body was properly parsed
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          error: 'Invalid request format',
          message: 'Request body must be a valid JSON object'
        });
      }
      
      // Check if this is a JSON-RPC request
      const isJsonRpc = req.body && req.body.jsonrpc === "2.0";
      
      // For JSON-RPC requests, validate format
      if (isJsonRpc && !req.body.method) {
        return res.status(400).json(createJSONRPCError(
          req.body.id ?? null,
          JSONRPC_ERROR_CODES.INVALID_REQUEST,
          "Invalid JSON-RPC 2.0 request: missing method"
        ));
      }
      
      // Execute the handler
      const result = await handler(req, res);
      
      if (!res.headersSent) {
        // Return response in appropriate format
        if (isJsonRpc) {
          res.json(createJSONRPCSuccess(req.body.id ?? null, result));
        } else {
          // Direct response for non-JSON-RPC requests
          res.json(result);
        }
      }
    } catch (error) {
      console.error("MCP Request Error:", error);
      
      // Check if this is a JSON-RPC request for error formatting
      if (req.body && req.body.jsonrpc === "2.0") {
        res.status(500).json(createJSONRPCError(
          req.body.id ?? null,
          JSONRPC_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal server error"
        ));
      } else {
        // Direct error response for non-JSON-RPC requests
        res.status(500).json({ 
          error: error instanceof Error ? error.message : "Internal server error" 
        });
      }
    }
  };
}
