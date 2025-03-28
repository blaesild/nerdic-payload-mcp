import { Router, Request } from "express";
import {
  queryValidationRules,
  queryProjectStructure,
} from "../../core/validation.js";
import { handleMCPRequest } from "../middleware/common.js";
import { ValidationError } from "../middleware/errorHandler.js";
import { ValidationRule } from "../../core/types.js";

const router = Router();

// GET /api/mcp/query/rules?ruleQuery=...
router.get(
  "/rules",
  handleMCPRequest(async (req: Request): Promise<ValidationRule[]> => {
    const ruleQuery = req.query.ruleQuery as string | undefined;
    return queryValidationRules(ruleQuery || "");
  }),
);

// Query Validation Rules
router.post(
  "/rules",
  handleMCPRequest(async (req) => {
    const { query } = req.body;
    if (!query) {
      throw new ValidationError("Missing required parameter: query");
    }
    req.mcpTool = "rules";
    return queryValidationRules(query);
  }),
);

// POST /api/mcp/query/structure
router.post(
  "/structure",
  handleMCPRequest(async (req) => {
    const { query, context } = req.body;
    if (!query || !context) {
      throw new ValidationError("Missing required parameters: query, context");
    }
    req.mcpTool = "structure";
    return queryProjectStructure(query, context);
  }),
);

export default router;
