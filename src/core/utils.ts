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
