import { Router, Request } from "express";
import { validateCode, ValidationMessage } from "@/core/validation.js";
import { handleMCPRequest } from "@/api/middleware/common.js";
import { ValidationError } from "@/api/middleware/errorHandler.js";
import { ValidationRule } from "@/core/types.js";

const router: Router = Router();

// POST /api/mcp/validate/code
router.post(
  "/code",
  handleMCPRequest(async (req: Request) => {
    const { code, fileType } = req.body;
    if (!code || !fileType) {
      throw new ValidationError("Missing required parameters: code, fileType");
    }
    if (typeof code !== "string") {
      throw new ValidationError("Parameter 'code' must be a string");
    }
    if (typeof fileType !== "string") {
      throw new ValidationError("Parameter 'fileType' must be a string");
    }
    // Validate fileType is one of the allowed types
    const allowedTypes: ValidationRule["appliesTo"][number][] = [
      "typescript",
      "payloadConfig",
      "collection",
      "field",
      "json",
    ];
    if (!allowedTypes.includes(fileType as ValidationRule["appliesTo"][number])) {
      throw new ValidationError(
        `Invalid fileType. Must be one of: ${allowedTypes.join(", ")}`
      );
    }
    return validateCode(code, fileType as ValidationRule["appliesTo"][number]);
  }),
);

export default router;
