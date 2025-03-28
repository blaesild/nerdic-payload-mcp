// This file is identical to the integrated version's src/mcp/types.ts

// Context expected by context-aware functions
export interface MCPContext {
  projectStructure: {
    collections: string[];
    globals: string[];
    plugins: string[];
    hooks: string[]; // List hook file names/paths perhaps
  };
  typeDefs: string; // Content of payload-types.ts
  relationships: {
    collection: string;
    relatesTo: string[]; // Slugs of related collections/globals
  }[];
  hookContext: {
    stage:
      | "beforeChange"
      | "afterChange"
      | "beforeRead"
      | "afterRead"
      | "beforeDelete"
      | "afterDelete"
      | "afterLogin"
      | "afterLogout"; // Expanded hook stages
    operation:
      | "create"
      | "update"
      | "read"
      | "delete"
      | "login"
      | "refresh"
      | "forgotPassword"; // Expanded operations
    collectionSlug?: string; // Optional: relevant collection
  } | null;
}

// Unified API Response Format
export interface MCPResponse<T = unknown> {
  tool: string; // Name of the MCP tool/function called
  success: boolean;
  data?: T;
  errors?: { message: string; details?: unknown }[];
  contextWarnings?: string[]; // Warnings about potentially outdated/incomplete context
}

// Specific types for generation/scaffolding options
export interface GenerateCollectionParams {
  slug: string;
  singular: string;
  plural: string;
  fields: FieldSpec[]; // Re-use FieldSpec type
  timestamps?: boolean;
  draft?: boolean;
  // ... other collection options (admin, hooks, access etc.) - Note: Server doesn't know Payload specifics
}

export interface FieldSpec {
  name: string;
  type:
    | "text"
    | "number"
    | "email"
    | "textarea"
    | "richText"
    | "select"
    | "checkbox"
    | "radio"
    | "relationship"
    | "upload"
    | "array"
    | "group"
    | "tabs"
    | "collapsible"
    | "row"
    | "point"
    | "date"
    | "code"
    | "json";
  required?: boolean;
  localized?: boolean; // Agent provides this info if relevant
  relationTo?: string | string[]; // Important for relationships
  // ... type-specific options (e.g., options, fields for blocks/groups/arrays)
  admin?: Record<string, unknown>; // Generic object for admin hints
  // ... other field options
}

export type TemplateType =
  | "collection" // Payload Collection
  | "global" // Payload Global
  | "field" // Payload Field Snippet
  | "hook" // Payload Hook
  | "accessControl" // Payload Access Control function
  | "endpoint" // Payload Custom Endpoint (conceptual code)
  | "component" // React Component (Admin UI or Frontend)
  | "plugin" // Payload Plugin structure
  | "test" // Generic Test file structure (e.g., Jest/Vitest)
  | "migration" // Payload Migration file structure
  | "customRoute" // e.g., Express route, Next.js route
  | "genericFunction" // Generic TS function
  | "genericClass"; // Generic TS class

export interface ScaffoldProjectConfig {
  projectName: string;
  dbAdapter: "mongoose" | "postgres"; // Used for generating config, not connecting
  plugins?: string[]; // Names of plugins to potentially include stubs for
  includeExample?: boolean; // Add a basic 'pages' collection
  framework?: "nextjs" | "express"; // Hint for framework-specific files
  // ... other create-payload-app like options
}

// Simplified structure query result type
export interface StructureQueryResult {
  collections: string[];
  globals: string[];
  plugins: string[];
  hooks: string[];
  // Add more structured info as needed
}

// Rule definition (example)
export interface ValidationRule {
  id: string;
  description: string;
  severity: "error" | "warning" | "info";
  appliesTo: (
    | "typescript"
    | "payloadConfig"
    | "collection"
    | "field"
    | "json"
  )[]; // Expanded types
  // Link to documentation or explanation
  docsUrl?: string;
}

// Error types
export interface MCPError {
  message: string;
  type: string;
  details?: string;
}

// --- Agent Context Extraction ---
// Type guard to help API validate incoming context
export function isMCPContext(obj: unknown): obj is MCPContext {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.projectStructure === "object" &&
    candidate.projectStructure !== null &&
    Array.isArray(
      (candidate.projectStructure as Record<string, unknown>).collections,
    ) &&
    Array.isArray(
      (candidate.projectStructure as Record<string, unknown>).globals,
    ) &&
    Array.isArray(
      (candidate.projectStructure as Record<string, unknown>).plugins,
    ) &&
    Array.isArray(
      (candidate.projectStructure as Record<string, unknown>).hooks,
    ) &&
    typeof candidate.typeDefs === "string" &&
    Array.isArray(candidate.relationships) &&
    (candidate.hookContext === null ||
      typeof candidate.hookContext === "object")
  );
}
