import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateField, generateTemplate, generateCollection, generateContextAwareCode } from './generation.js';

// Create a new MCP server instance
export const mcpServer = new McpServer({
  name: 'nerdic-payload-mcp',
  version: '1.0.0',
  description: 'Payload MCP tool for generating payload specific structures'
});

// Add validation tool
mcpServer.tool(
  'validate',
  {
    schema: z.string(),
    data: z.any()
  },
  async ({ schema, data }) => {
    try {
      // This is a placeholder - actual validation would be implemented in the handler
      return {
        content: [{ 
          type: 'text', 
          text: `Validation result for schema: ${schema}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Add query tool
mcpServer.tool(
  'query',
  {
    query: z.string()
  },
  async ({ query }) => {
    try {
      // This is a placeholder - actual query handling would be implemented
      return {
        content: [{ 
          type: 'text', 
          text: `Query result for: ${query}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Register proper generate tool that handles all generate subtypes
mcpServer.tool(
  'generate',
  {
    type: z.string(),
    options: z.record(z.any())
  },
  async ({ type, options }) => {
    console.log(`[MCP SERVER] Processing generate request: type=${type}, options=`, options);
    
    try {
      let result;
      
      switch (type) {
        case 'field': {
          if (!options.name || !options.type) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Missing required field parameters: name, type` 
              }],
              isError: true
            };
          }
          
          result = await generateField(options);
          break;
        }
          
        case 'collection': {
          if (!options.slug || !options.fields) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Missing required collection parameters: slug, fields` 
              }],
              isError: true
            };
          }
          
          result = await generateCollection(options);
          break;
        }
          
        case 'template': {
          if (!options.type) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Missing required template parameter: type` 
              }],
              isError: true
            };
          }
          
          result = await generateTemplate(options.type, options);
          break;
        }
          
        case 'code': {
          if (!options.prompt || !options.context) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Missing required code parameters: prompt, context` 
              }],
              isError: true
            };
          }
          
          if (typeof options.prompt !== "string") {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Parameter 'prompt' must be a string` 
              }],
              isError: true
            };
          }
          
          result = await generateContextAwareCode(options.prompt, options.context);
          break;
        }
          
        default:
          return {
            content: [{ 
              type: 'text', 
              text: `Error: Unknown generation type: ${type}` 
            }],
            isError: true
          };
      }
      
      console.log(`[MCP SERVER] Generation result for ${type}:`, typeof result === 'string' ? result.substring(0, 100) + '...' : result);
      
      return {
        content: [{ 
          type: 'code', 
          text: result,
          language: type === 'field' ? 'json' : 'typescript'
        }]
      };
    } catch (error) {
      console.error(`[MCP SERVER] Generation error:`, error);
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Also add individual tools for direct calling
mcpServer.tool(
  'field',
  {
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    // Add other possible field properties as optional
    label: z.string().optional(),
    unique: z.boolean().optional(),
    localized: z.boolean().optional()
  },
  async (fieldSpec) => {
    try {
      const result = await generateField(fieldSpec);
      return {
        content: [{ 
          type: 'code', 
          text: result,
          language: 'json'
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error generating field: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Add scaffold tool
mcpServer.tool(
  'scaffold',
  {
    type: z.string(),
    parameters: z.record(z.any()).optional()
  },
  async ({ type, parameters }) => {
    try {
      // This is a placeholder - actual scaffolding would be implemented
      return {
        content: [{ 
          type: 'text', 
          text: `Scaffolded ${type} with parameters: ${JSON.stringify(parameters)}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

export default mcpServer; 