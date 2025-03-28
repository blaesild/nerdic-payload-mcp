import { Request, Response, NextFunction } from "express";
import { isMCPContext, MCPContext } from "../../core/types";
import { createSuccessResponse } from "@/core/utils.js"; // Correct path

// Middleware to attach tool name for consistent responses/error handling
export function setMCPTool(toolName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.mcpTool = toolName;
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

  if (body?.context) {
    if (isMCPContext(body.context)) {
      context = body.context;
    } else {
      contextWarnings.push(
        "Received context object does not match expected MCPContext structure.",
      );
      console.warn("MCP API: Invalid context object received:", body.context);
    }
  } else if (requiresContext) {
    const err = new Error(
      "MCPContext is required but was not provided in the request body.",
    ) as Error & { status: number };
    err.status = 400;
    throw err;
  }

  return { context, contextWarnings };
}

// Higher-order function to wrap route handlers with common logic
export function handleMCPRequest<T>(
  handler: (req: Request, context?: MCPContext) => Promise<T>,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { context, contextWarnings } = getContext(req, true);

      const result = await handler(req, context);

      if (result !== undefined && !res.headersSent) {
        res.json(
          createSuccessResponse(
            req.mcpTool || "unknown",
            result,
            contextWarnings.length > 0 ? contextWarnings : undefined,
          ),
        );
      } else if (!res.headersSent && result === undefined) {
        console.warn(
          `MCP Handler for tool ${req.mcpTool} finished without sending response or returning data.`,
        );
        res.status(204).send();
      }
    } catch (error) {
      next(error);
    }
  };
}
