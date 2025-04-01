import prettier from "prettier";
import { JSONRPC2Request, JSONRPC2Response } from "./types.js";

const PROTOCOL_VERSION = "2024-11-05";

// Placeholder for formatting code (using Prettier potentially)
export async function formatCode(
  code: string,
  parser: prettier.LiteralUnion<prettier.BuiltInParserName, string> = "typescript",
): Promise<string> {
  try {
    return await prettier.format(code, {
      parser,
      semi: true,
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
    });
  } catch (e) {
    console.warn(
      `Prettier formatting failed for parser '${parser}':`,
      e instanceof Error ? e.message : String(e),
    );
    return code;
  }
}

// Helper function to create a successful JSON-RPC 2.0 response
export function createJSONRPCSuccess(id: number | string | null, result: any): JSONRPC2Response {
  return {
    jsonrpc: "2.0",
    result,
    id
  };
}

// Helper function to create an error JSON-RPC 2.0 response
export function createJSONRPCError(
  id: number | string | null,
  code: number,
  message: string,
  data?: any
): JSONRPC2Response {
  return {
    jsonrpc: "2.0",
    error: {
      code,
      message,
      data
    },
    id
  };
}

// Helper function to create a JSON-RPC 2.0 request
export function createJSONRPCRequest(
  method: string,
  params?: any,
  id?: number | string
): JSONRPC2Request {
  return {
    jsonrpc: "2.0",
    method,
    params,
    id: id ?? Date.now()
  };
}

// JSON-RPC 2.0 Error Codes
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099
} as const;

/**
 * Extract parameters from different JSON-RPC request formats
 * This handles all the different ways parameters can be specified:
 * 1. Direct parameters in request body
 * 2. JSON-RPC format with parameters in params field
 * 3. JSON-RPC format with callTool method and nested parameters
 * 4. JSON-RPC format with callTool and specific tool parameters
 */
export function extractJSONRPCParams(body: any, toolName?: string): any {
  // Check if this is a JSON-RPC request
  const isJsonRpc = body && body.jsonrpc === "2.0";
  
  if (!isJsonRpc) {
    // Direct parameters in body
    return body;
  }
  
  // JSON-RPC 2.0 request
  if (body.method === "callTool" && body.params) {
    // Format: { jsonrpc: "2.0", method: "callTool", params: { name: "toolName", arguments: {...} } }
    if (body.params.name && body.params.arguments) {
      // If a specific tool name is provided, verify it matches
      if (toolName && body.params.name !== toolName) {
        // Different tool requested, check if the expected tool is in the arguments
        if (body.params.arguments.type === toolName) {
          // The tool is specified as type, extract options if available
          return body.params.arguments.options || body.params.arguments;
        }
        
        // No tool match, return direct arguments
        return body.params.arguments;
      }
      
      // Tool match or no specific tool required, extract arguments
      return body.params.arguments;
    }
    
    // No name/arguments structure, return params directly
    return body.params;
  }
  
  // Regular JSON-RPC format: { jsonrpc: "2.0", method: "method", params: {...} }
  if (body.params) {
    return body.params;
  }
  
  // Fallback to empty object
  return {};
}
