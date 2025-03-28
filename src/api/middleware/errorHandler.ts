import { Request, Response, NextFunction } from "express";
import { MCPError } from "../../core/types";

// Custom error types
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

// Error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("MCP Error Handler:", err);

  const error: MCPError = {
    message: err.message || "An unexpected error occurred",
    type: err.name || "Error",
    details: err.stack,
  };

  // Set appropriate status code based on error type
  let statusCode = 500;
  switch (err.name) {
    case "ValidationError":
      statusCode = 400;
      break;
    case "ConfigurationError":
      statusCode = 400;
      break;
    case "GenerationError":
      statusCode = 422;
      break;
    default:
      statusCode = 500;
  }

  res.status(statusCode).json({ error });
}

// Extend Express Request type to allow attaching tool name
declare module "express" {
  interface Request {
    mcpTool?: string;
  }
}
