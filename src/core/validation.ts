import { ValidationRule, MCPContext, StructureQueryResult } from "./types.js";
// Potentially import ESLint API dynamically if needed
// import { ESLint } from 'eslint';

// --- Mock Rule Database ---
const validationRules: ValidationRule[] = [
  {
    id: "PAYLOAD001",
    description: "Collections slugs should be kebab-case.",
    severity: "warning",
    appliesTo: ["collection", "payloadConfig"],
  },
  {
    id: "PAYLOAD002",
    description: "Prefer `blockSlug` over `slug` for Block definitions.",
    severity: "warning",
    appliesTo: ["collection", "field"],
  },
  {
    id: "TS001",
    description: "Avoid using `any` type.",
    severity: "warning",
    appliesTo: ["typescript"],
  },
  {
    id: "JSON001",
    description: "Ensure JSON is well-formed.",
    severity: "error",
    appliesTo: ["json"],
  },
  // ... add more rules
];

// Rule definition (example)
export interface ValidationMessage {
  ruleId: string;
  message: string;
  details?: string;
  line?: number;
  column?: number;
}

// 1. Validation Tools
export async function validateCode(
  code: string,
  fileType: ValidationRule["appliesTo"][number],
): Promise<{ errors: ValidationMessage[]; warnings: ValidationMessage[] }> {
  console.log(
    `MCP Core: Validating code (type: ${fileType}). Length: ${code.length}`,
  );
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  // Basic JSON validation for relevant types
  if (fileType === "json") {
    try {
      JSON.parse(code);
    } catch (e) {
      errors.push({
        ruleId: "JSON001",
        message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
        details: validationRules.find((r) => r.id === "JSON001")?.description,
      });
    }
  }

  // Placeholder for ESLint Integration (dynamic import recommended)
  // try {
  //   const { ESLint } = await import('eslint');
  //   const eslint = new ESLint({ useEslintrc: false, overrideConfig: { /* config */ } });
  //   const results = await eslint.lintText(code, { filePath: `virtual.${fileType === 'typescript' ? 'ts' : 'json'}` });
  //   results.forEach(result => {
  //       result.messages.forEach(msg => {
  //           if (msg.severity === 2) errors.push({ ruleId: msg.ruleId, message: msg.message, line: msg.line, column: msg.column });
  //           if (msg.severity === 1) warnings.push({ ruleId: msg.ruleId, message: msg.message, line: msg.line, column: msg.column });
  //       });
  //   });
  // } catch (e) {
  //   console.error("ESLint validation failed:", e);
  //   warnings.push({ message: "Linting process could not run." });
  // }

  // Placeholder for Best Practice Checks (using mock rules)
  const applicableRules = validationRules.filter((rule) =>
    rule.appliesTo.includes(
      fileType as
        | "json"
        | "collection"
        | "field"
        | "typescript"
        | "payloadConfig",
    ),
  );

  // Example simple checks
  applicableRules.forEach((rule) => {
    if (
      rule.id === "PAYLOAD001" &&
      (fileType === "payloadConfig" || fileType === "collection")
    ) {
      const slugMatches = code.match(/slug:\s*['"]([a-zA-Z0-9_-]+)['"]/g) || [];
      slugMatches.forEach((match) => {
        const slug = match.split(/['"]/)[1];
        if (slug && slug !== slug.toLowerCase().replace(/_/g, "-")) {
          if (
            !warnings.some(
              (w) => w.ruleId === rule.id && w.message.includes(slug),
            )
          ) {
            // Avoid duplicates
            warnings.push({
              ruleId: rule.id,
              message: `Potential non-kebab-case slug found: '${slug}'.`,
              details: rule.description,
            });
          }
        }
      });
    }
    if (rule.id === "TS001" && fileType === "typescript") {
      if (/\Wany\W/.test(code)) {
        // Very basic check for 'any'
        if (!warnings.some((w) => w.ruleId === rule.id)) {
          warnings.push({
            ruleId: rule.id,
            message: `Code contains 'any'. ${rule.description}`,
            details: rule.description,
          });
        }
      }
    }
    // Add more simple rule checks here...
  });

  console.log(
    `MCP Core: Validation complete. Found ${errors.length} errors, ${warnings.length} warnings.`,
  );
  return { errors, warnings };
}

export async function queryValidationRules(
  ruleQuery: string,
): Promise<ValidationRule[]> {
  console.log(`MCP Core: Querying validation rules for: "${ruleQuery}"`);
  if (!ruleQuery) {
    return validationRules;
  }
  const queryLower = ruleQuery.toLowerCase();
  return validationRules.filter(
    (rule) =>
      rule.id.toLowerCase().includes(queryLower) ||
      rule.description.toLowerCase().includes(queryLower) ||
      rule.appliesTo.some((type) => type.toLowerCase().includes(queryLower)),
  );
}

// This interprets mcp_query as querying the *provided context*, not a live DB
export async function queryProjectStructure(
  query: string,
  context: MCPContext,
): Promise<StructureQueryResult> {
  console.log(
    `MCP Core: Querying project structure from provided context. Query: "${query}"`,
  );
  // Basic implementation: return parts of the project structure based on query hint
  // A real implementation might parse the 'query' string more intelligently.
  // Example: if query mentions 'collections', return only collections.
  const result: StructureQueryResult = {
    collections: context.projectStructure.collections,
    globals: context.projectStructure.globals,
    plugins: context.projectStructure.plugins,
    hooks: context.projectStructure.hooks,
  };
  // Very basic filtering based on query string content
  if (query.toLowerCase().includes("collection"))
    return { ...result, globals: [], plugins: [], hooks: [] };
  if (query.toLowerCase().includes("global"))
    return { ...result, collections: [], plugins: [], hooks: [] };
  if (query.toLowerCase().includes("hook"))
    return { ...result, collections: [], globals: [], plugins: [] };

  return result; // Return everything if no clear filter matches
}
