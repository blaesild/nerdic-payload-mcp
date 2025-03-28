import prettier from "prettier";
import { MCPResponse } from "./types.js"; // Use .js extension for ESM module resolution

// Placeholder for formatting code (using Prettier potentially)
export async function formatCode(
  code: string,
  parser: prettier.LiteralUnion<
    prettier.BuiltInParserName,
    string
  > = "typescript",
): Promise<string> {
  try {
    // Basic prettier config, customize as needed
    return await prettier.format(code, {
      parser,
      semi: true,
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
      // Add typescript specific options if needed
    });
  } catch (e) {
    console.warn(
      `Prettier formatting failed for parser '${parser}':`,
      e instanceof Error ? e.message : String(e),
    );
    return code; // Return unformatted code on error
  }
}

// Helper to create consistent API responses (used by route handlers)
// Note: This is slightly different from the integrated version; it's used WITHIN route handlers now.
export function createSuccessResponse<T>(
  tool: string,
  data: T,
  contextWarnings?: string[],
): MCPResponse<T> {
  return {
    tool,
    success: true,
    data,
    contextWarnings,
  };
}

// Error responses are typically handled by the error middleware now
