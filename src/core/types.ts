import { z } from 'zod';

// Base context schema for MCP operations
export const MCPContextSchema = z.object({
  projectType: z.string(),
  targetPath: z.string(),
  options: z.record(z.unknown()).optional(),
});

// Response schema for MCP operations
export const MCPResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  message: z.string().optional(),
});

// TypeScript types derived from schemas
export type MCPContext = z.infer<typeof MCPContextSchema>;
export type MCPResponse = z.infer<typeof MCPResponseSchema>;

// Generation specific types
export interface GenerationOptions {
  template?: string;
  variables?: Record<string, unknown>;
  force?: boolean;
}

// Validation specific types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Scaffolding specific types
export interface ScaffoldingOptions {
  template: string;
  destination: string;
  variables?: Record<string, unknown>;
}

// Query specific types
export interface QueryOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'>;
  limit?: number;
} 