import { Router } from "express";
import {
  generateTemplate,
  generateCollection,
  generateField,
  generateContextAwareCode,
} from "../../core/generation.js";
import { handleMCPRequest } from "../middleware/common.js";
import { ValidationError } from "../middleware/errorHandler.js";

const router = Router();

// POST /api/mcp/generate/template
router.post(
  "/template",
  handleMCPRequest(async (req) => {
    const { type, options } = req.body;
    if (!type || !options) {
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
    const params = req.body;
    if (!params.slug || !params.fields) {
      throw new ValidationError("Missing required parameters: slug, fields");
    }
    req.mcpTool = "collection";
    return generateCollection(params);
  }),
);

// POST /api/mcp/generate/field
router.post(
  "/field",
  handleMCPRequest(async (req) => {
    const specs = req.body;
    if (!specs.name || !specs.type) {
      throw new ValidationError("Missing required parameters: name, type");
    }
    req.mcpTool = "field";
    return generateField(specs);
  }),
);

// POST /api/mcp/generate/code
router.post(
  "/code",
  handleMCPRequest(async (req) => {
    const { prompt, context } = req.body;
    if (!prompt || !context) {
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
