import { Request, Response, NextFunction } from "express";
import { isMCPContext, MCPContext } from "../../core/types";
import { createJSONRPCSuccess, createJSONRPCError, JSONRPC_ERROR_CODES } from "@/core/utils.js";

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

  if (body?.params?.context) {
    if (isMCPContext(body.params.context)) {
      context = body.params.context;
    } else {
      contextWarnings.push(
        "Received context object does not match expected MCPContext structure.",
      );
      console.warn("MCP API: Invalid context object received:", body.params.context);
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
      // Validate JSON-RPC request
      if (!req.body.jsonrpc || req.body.jsonrpc !== "2.0" || !req.body.method) {
        return res.status(400).json(createJSONRPCError(
          req.body.id ?? null,
          JSONRPC_ERROR_CODES.INVALID_REQUEST,
          "Invalid JSON-RPC 2.0 request"
        ));
      }

      const result = await handler(req, res);
      
      if (!res.headersSent) {
        res.json(createJSONRPCSuccess(req.body.id ?? null, result));
      }
    } catch (error) {
      console.error("MCP Request Error:", error);
      res.status(500).json(createJSONRPCError(
        req.body.id ?? null,
        JSONRPC_ERROR_CODES.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Internal server error"
      ));
    }
  };
}
