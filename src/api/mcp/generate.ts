import { Router } from "express";
import {
  generateTemplate,
  generateCollection,
  generateField,
  generateContextAwareCode,
} from "../../core/generation.js";
import { handleMCPRequest } from "../middleware/common.js";
import { ValidationError } from "../middleware/errorHandler.js";
import { extractJSONRPCParams } from "../../core/utils.js";

const router: Router = Router();

// POST /api/mcp/generate/template
router.post(
  "/template",
  handleMCPRequest(async (req) => {
    console.log('[TEMPLATE DEBUG] Received body:', req.body);
    
    // Extract parameters using the utility function
    const params = extractJSONRPCParams(req.body, "template");
    console.log('[TEMPLATE DEBUG] Extracted parameters:', params);
    
    // Handle both direct type+options format and nested format
    let type, options;
    
    if (params.type === 'template' && params.options) {
      // Format: { type: 'template', options: {...} }
      type = 'template';
      options = params.options;
    } else if (params.type) {
      // Format: { type: '...', options: {...} }
      type = params.type;
      options = params.options;
    } else {
      // Assume direct options with type field
      type = params.templateType || 'component';
      options = params;
    }
    
    if (!type || !options) {
      console.log('[TEMPLATE DEBUG] Validation failed - missing required params');
      throw new ValidationError("Missing required parameters: type, options");
    }
    
    req.mcpTool = "template";
    return generateTemplate(type, options);
  }),
);

// POST /api/mcp/generate/collection
router.post(
  "/collection",
  handleMCPRequest(async (req) => {
    console.log('[COLLECTION DEBUG] Received body:', req.body);
    
    // Extract parameters using the utility function
    const params = extractJSONRPCParams(req.body, "collection");
    console.log('[COLLECTION DEBUG] Extracted parameters:', params);
    
    // Check if nested in type/options
    let collectionParams;
    
    if (params.type === 'collection' && params.options) {
      // Format: { type: 'collection', options: {...} }
      collectionParams = params.options;
    } else {
      // Direct parameters
      collectionParams = params;
    }
    
    if (!collectionParams || !collectionParams.slug || !collectionParams.fields) {
      console.log('[COLLECTION DEBUG] Validation failed - missing required params');
      throw new ValidationError("Missing required parameters: slug, fields");
    }
    
    req.mcpTool = "collection";
    return generateCollection(collectionParams);
  }),
);

// POST /api/mcp/generate/field
router.post(
  "/field",
  handleMCPRequest(async (req) => {
    console.log('[FIELD DEBUG] Received body:', req.body);
    
    // Extract parameters using the utility function
    const params = extractJSONRPCParams(req.body, "field");
    console.log('[FIELD DEBUG] Extracted parameters:', params);
    
    // Check if nested in type/options
    let fieldSpec;
    
    if (params.type === 'field' && params.options) {
      // Format: { type: 'field', options: {...} }
      fieldSpec = params.options;
    } else {
      // Direct field spec
      fieldSpec = params;
    }
    
    // Validate required parameters
    if (!fieldSpec || !fieldSpec.name || !fieldSpec.type) {
      console.log('[FIELD DEBUG] Validation failed - missing required params');
      throw new ValidationError("Missing required parameters: name, type");
    }
    
    req.mcpTool = "field";
    return generateField(fieldSpec);
  }),
);

// POST /api/mcp/generate/code
router.post(
  "/code",
  handleMCPRequest(async (req) => {
    console.log('[CODE DEBUG] Received body:', req.body);
    
    // Extract parameters using the utility function
    const params = extractJSONRPCParams(req.body, "code");
    console.log('[CODE DEBUG] Extracted parameters:', params);
    
    // Handle both code generation format types
    let prompt, context;
    
    if (params.type === 'code' && params.options) {
      // Format: { type: 'code', options: { prompt, context } }
      prompt = params.options.prompt;
      context = params.options.context;
    } else {
      // Direct parameters
      prompt = params.prompt;
      context = params.context;
    }
    
    if (!prompt || !context) {
      console.log('[CODE DEBUG] Validation failed - missing required params');
      throw new ValidationError("Missing required parameters: prompt, context");
    }
    
    if (typeof prompt !== "string") {
      throw new ValidationError("Parameter 'prompt' must be a string");
    }
    
    req.mcpTool = "code";
    return generateContextAwareCode(prompt, context);
  }),
);

export default router;
