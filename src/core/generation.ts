import OpenAI from "openai"; // Import your LLM SDK
import {
  TemplateType,
  FieldSpec,
  GenerateCollectionParams,
  MCPContext,
} from "./types.js";
import { formatCode } from "./utils.js";

// --- LLM Setup (Example OpenAI) ---
let openai: OpenAI | null = null;

// Function to initialize OpenAI client
export function initializeOpenAI() {
  try {
    if (process.env.OPENAI_API_KEY) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log("MCP Core: OpenAI client initialized.");
      return true;
    }
    return false;
  } catch (error) {
    console.error("MCP Core: Failed to initialize OpenAI client:", error);
    return false;
  }
}

// Initialize on module load
try {
  console.log("MCP Core: Checking environment variables...");
  console.log("MCP Core: Available env vars:", Object.keys(process.env));
  console.log("MCP Core: OPENAI_API_KEY value:", process.env.OPENAI_API_KEY ? "sk-..." : "undefined");
  console.log("MCP Core: OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "MCP Core: OPENAI_API_KEY not found in environment variables. Context-aware generation disabled.",
    );
  } else {
    initializeOpenAI();
  }
} catch (error) {
  console.error("MCP Core: Failed to initialize OpenAI client:", error);
}

// Template options types
interface BaseTemplateOptions {
  name?: string;
}

interface CollectionTemplateOptions extends BaseTemplateOptions {
  slug?: string;
  plural?: string;
}

interface GlobalTemplateOptions extends BaseTemplateOptions {
  slug?: string;
  singular?: string;
}

interface HookTemplateOptions extends BaseTemplateOptions {
  stage?: string;
}

interface ComponentTemplateOptions extends BaseTemplateOptions {
  name: string;
}

interface PluginTemplateOptions extends BaseTemplateOptions {
  name: string;
}

interface CustomRouteTemplateOptions extends BaseTemplateOptions {
  path?: string;
}

type TemplateOptions =
  | CollectionTemplateOptions
  | GlobalTemplateOptions
  | HookTemplateOptions
  | ComponentTemplateOptions
  | PluginTemplateOptions
  | CustomRouteTemplateOptions
  | FieldSpec
  | Record<string, unknown>;

// --- Template Definitions (Identical to integrated version) ---
// NOTE: Keep template definitions concise and focused on structure.
// Payload-specific details (like exact hook signatures) might vary slightly
// and the LLM is better suited for generating those contextually.

// Assume standard Payload CMS types (`CollectionConfig`, `Field`, hook signatures, etc.)
// are available in the target project where this code will be used.

const templates: Record<TemplateType, (options: TemplateOptions) => string> = {
  collection: (options) => {
    const { slug = "new-items", plural = "New Items" } =
      options as CollectionTemplateOptions;
    return `
import { CollectionConfig } from 'payload/types'; // Assume this type exists in the target project

const ${plural.replace(/\s+/g, "")}: CollectionConfig = {
  slug: '${slug}',
  admin: {
    useAsTitle: 'title', // Default assumption
  },
  fields: [
    { name: 'title', type: 'text', required: true },
  ],
};
export default ${plural.replace(/\s+/g, "")};`;
  },
  global: (options) => {
    const { slug = "site-settings", singular = "Site Settings" } =
      options as GlobalTemplateOptions;
    return `
import { GlobalConfig } from 'payload/types'; // Assume this type exists

const ${singular.replace(/\s+/g, "")}: GlobalConfig = {
  slug: '${slug}',
  fields: [
    { name: 'siteName', type: 'text' },
  ],
};
export default ${singular.replace(/\s+/g, "")};`;
  },
  field: (options) => JSON.stringify(options as FieldSpec, null, 2), // Simple JSON representation
  hook: (options) => {
    const { stage = "beforeChange" } = options as HookTemplateOptions;
    return `
// Generic hook structure - adjust type imports and args based on context
export const myHook: /* Determine Type e.g., CollectionBeforeChangeHook */ = async (args) => {
  const { data, req, operation, originalDoc } = args; // Example args
  console.log('Running ${stage} hook...');
  // Your logic here
  return data; // Return data for 'before' hooks
};`;
  },
  accessControl: (options) => {
    const { name = "isLoggedIn" } = options as BaseTemplateOptions;
    return `
// Generic access control structure - adjust type imports based on context
export const ${name}: /* Determine Type e.g., Access */ = ({ req: { user } }) => {
  // Your logic here
  return Boolean(user); // Example: Allow if logged in
};`;
  },
  endpoint: () => `
// Generic custom endpoint structure - adjust based on framework (Express/Payload/Next)
export const customHandler = async (req, res, next) => {
  try {
    // Your logic here
    res.json({ message: 'Custom endpoint reached' });
  } catch (error) {
    next(error); // Pass error to error handler
  }
};`,
  component: (options) => {
    const { name = "MyComponent" } = options as ComponentTemplateOptions;
    return `
import React from 'react'; // Assuming React context

interface ${name}Props {
  // Define props
}

const ${name}: React.FC<${name}Props> = (props) => {
  return (
    <div>
      {/* Your component JSX */}
      Hello from ${name}
    </div>
  );
};

export default ${name};`;
  },
  plugin: (options) => {
    const { name = "myPlugin" } = options as PluginTemplateOptions;
    return `
// Generic Payload plugin structure - adjust type imports based on context
export const ${name} = (pluginOptions) => (incomingConfig) => {
  let config = { ...incomingConfig };
  console.log('${name} initialized');
  // Modify config here...
  // config.collections = [...];
  // config.hooks = {...};
  return config;
};`;
  },
  test: (options) => {
    const { name = "myTest" } = options as BaseTemplateOptions;
    return `
describe('${name}', () => {
  beforeAll(async () => {
    // Setup tests
  });

  it('should do something correctly', () => {
    expect(true).toBe(true);
  });

  afterAll(async () => {
    // Teardown tests
  });
});`;
  },
  migration: () => `
// Generic migration structure - adjust imports and DB commands based on context
export async function up({ payload /* or db client */ }) {
  console.log('Running migration up...');
  // await db.execute('...');
};

export async function down({ payload /* or db client */ }) {
  console.log('Running migration down...');
  // await db.execute('...');
};`,
  customRoute: (options) => {
    const { path = "/custom" } = options as CustomRouteTemplateOptions;
    return `
// Generic route structure - adjust based on framework (Express/Next etc.)
// Example for Express:
// router.get('${path}', (req, res) => { res.json({ message: 'Custom route' }); });

// Example for Next.js API Route:
// export default function handler(req, res) { res.status(200).json({ message: 'Custom route' }); }
`;
  },
  genericFunction: (options) => {
    const { name = "myFunction" } = options as BaseTemplateOptions;
    return `
export function ${name}(/* define params */): /* define return type */ {
  // Function logic here
  console.log('Executing ${name}');
}
`;
  },
  genericClass: (options) => {
    const { name = "MyClass" } = options as BaseTemplateOptions;
    return `
export class ${name} {
  // Define properties
  // constructor(/* define params */) {
    // Initialize properties
  // }

  // Define methods
  myMethod() {
    console.log('Method in ${name} called');
  }
}
`;
  },
};

// 2. Code Generation
export async function generateTemplate(
  type: TemplateType,
  options: TemplateOptions,
): Promise<string> {
  console.log(`MCP Core: Generating template for type: ${type}`);
  const generator = templates[type];
  if (!generator) {
    throw new Error(
      `Invalid template type: ${type}. Valid types are: ${Object.keys(templates).join(", ")}`,
    );
  }
  // Format based on likely content type
  const parser = ["component"].includes(type)
    ? "typescript" // Assuming TSX/JSX
    : ["field"].includes(type)
      ? "json" // Field specs are often object literals
      : "typescript"; // Default to TS
  const rawCode = generator(options);
  return formatCode(rawCode, parser);
}

// Sync version used internally
function generateFieldSync(specs: FieldSpec): string {
  let fieldString = "{";
  const keys = Object.keys(specs) as Array<keyof FieldSpec>;
  keys.forEach((key, index) => {
    const value = specs[key];
    if (value !== undefined) {
      // Simple stringify, might need enhancement for functions etc.
      let valueString = JSON.stringify(value, null, 2);
      // Indent nested lines
      valueString = valueString
        .split("\n")
        .map((line, i) => (i === 0 ? line : `  ${line}`))
        .join("\n");

      fieldString += `\n  ${key}: ${valueString}${index < keys.length - 1 ? "," : ""}`;
    }
  });
  fieldString += "\n}";
  return fieldString;
}

export async function generateCollection(
  params: GenerateCollectionParams,
): Promise<string> {
  console.log(
    `MCP Core: Generating full collection definition for slug: ${params.slug}`,
  );
  const fieldDefs = params.fields.map(generateFieldSync); // Use sync version

  const collectionConfigCode = `
// Generated by MCP - Ensure Payload types are available in the target project
// import { CollectionConfig } from 'payload/types';

const ${params.plural.replace(/[^a-zA-Z0-9]/g, "")}: /* CollectionConfig */ = {
  slug: '${params.slug}',
  admin: {
    useAsTitle: '${params.fields.find((f) => f.name === "title" || f.type === "text")?.name || params.fields[0]?.name || "id"}',
    // Add other admin hints if provided in params
  },
  // access: { // Add access control stubs if requested
  //   read: () => true,
  // },
  fields: [
    ${fieldDefs.join(",\n    ")}
  ],
  ${params.timestamps ? "timestamps: true," : ""}
  ${params.draft ? "versions: { drafts: true }," : ""}
  // ... other collection settings
};

export default ${params.plural.replace(/[^a-zA-Z0-9]/g, "")};
  `;
  return formatCode(collectionConfigCode, "typescript");
}

export async function generateField(specs: FieldSpec): Promise<string> {
  console.log(
    `MCP Core: Generating field definition for: ${specs.name} (${specs.type})`,
  );
  const fieldCode = generateFieldSync(specs);
  // Format as object literal (using TS parser handles it well)
  return formatCode(fieldCode, "typescript");
}

// --- Context-Aware Generation ---
export async function generateContextAwareCode(
  prompt: string,
  context: MCPContext,
): Promise<string> {
  console.log(`MCP Core: Generating context-aware code. Prompt: "${prompt}"`);

  if (!openai) {
    throw new Error("LLM client (OpenAI) is not initialized. Check API key.");
  }

  // 1. Prepare Context for LLM (Identical logic to integrated version)
  let contextString = `
// --- Project Context ---

// Structure:
// Collections: ${context.projectStructure.collections.join(", ")}
// Globals: ${context.projectStructure.globals.join(", ")}

// Your task is to generate code based on the user's request, leveraging the provided project context.
// Ensure the generated code follows best practices and integrates correctly with the existing structure and types hinted at in the context.
// Assume standard Payload CMS types (\`CollectionConfig\`, \`Field\`, hook signatures, etc.) are available in the target project where this code will be used.
`;

  if (context.hookContext) {
    contextString += `
// Current Hook Context:
// Stage: ${context.hookContext.stage}
// Operation: ${context.hookContext.operation}
${context.hookContext.collectionSlug ? `// Collection: ${context.hookContext.collectionSlug}` : ""}
`;
  }

  // 2. Construct the Full Prompt for the LLM (Same logic)
  const fullPrompt = `
You are an expert backend developer experienced with Payload CMS 3.0 and TypeScript.
Your task is to generate code based on the user's request, leveraging the provided project context.
Ensure the generated code follows best practices and integrates correctly with the existing structure and types hinted at in the context.
Assume standard Payload CMS types (\`CollectionConfig\`, \`Field\`, hook signatures, etc.) are available in the target project where this code will be used.

${contextString}

// --- User Request ---
${prompt}

// --- Generated Code ---
// Please provide ONLY the TypeScript code block relevant to the request.
// Use TypeScript. Adhere to the types provided in the context if possible.
// If generating hooks, use the correct signature and be mindful of the stage/operation.
// If generating fields for Payload, use the standard Payload field definition format (object literal).
// If modifying existing structures (conceptually), indicate where the code should be placed via comments if necessary.
// Do NOT include explanations outside the code block.

\`\`\`typescript
// Your code here...
\`\`\`
`;

  // 3. Call LLM Service
  console.log("MCP Core: Sending prompt to LLM...");
  try {
    const completion = await openai.chat.completions.create({
      // Choose appropriate model (gpt-3.5-turbo, gpt-4, etc.)
      // gpt-4 tends to follow instructions better for code generation
      model: "gpt-4-turbo-preview", // Or "gpt-3.5-turbo"
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.2, // Lower temperature for more predictable code
      max_tokens: 1000, // Adjust as needed
      // stop: ["```"], // Maybe stop at the end fence
    });

    const llmResponse = completion.choices[0]?.message?.content?.trim() || "";
    console.log("MCP Core: Received LLM response.");

    // 4. Extract code from LLM response
    const codeBlockMatch = llmResponse.match(/```typescript\n([\s\S]*?)\n```/);
    let generatedCode = codeBlockMatch ? codeBlockMatch[1].trim() : llmResponse; // Fallback to full response if no block found

    // Handle potential empty or placeholder responses
    if (!generatedCode || generatedCode.startsWith("// Your code here...")) {
      generatedCode = `// LLM did not provide specific code for the prompt: "${prompt}"`;
    }

    // 5. Format and Return
    return formatCode(generatedCode, "typescript");
  } catch (error: unknown) {
    console.error("MCP Core: Error calling LLM:", error);
    // Provide a useful error message back to the agent/user
    if (error && typeof error === "object" && "response" in error) {
      // Handle OpenAI API errors
      const apiError = error as {
        response: { status: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      console.error("LLM API Error Details:", apiError.response.data);
      throw new Error(
        `LLM API request failed: ${apiError.response.status} ${apiError.response.data?.error?.message || apiError.message}`,
      );
    }
    throw new Error(
      `Failed to generate code via LLM: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
