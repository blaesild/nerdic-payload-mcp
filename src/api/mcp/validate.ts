import { Router, Request } from "express";
import { validateCode, ValidationMessage } from "@/core/validation.js";
import { handleMCPRequest } from "@/api/middleware/common.js";
import { ValidationError } from "@/api/middleware/errorHandler.js";
import { ValidationRule } from "@/core/types.js";

const router = Router();

// POST /api/mcp/validate/code
router.post(
  "/code",
  handleMCPRequest(
    async (
      req: Request,
    ): Promise<{
      errors: ValidationMessage[];
      warnings: ValidationMessage[];
    }> => {
      const { code, fileType } = req.body;
      if (typeof code !== "string" || typeof fileType !== "string") {
        throw new ValidationError(
          'Missing or invalid parameters: "code" (string) and "fileType" (string) are required.',
        );
      }
      // Add fileType enum validation if needed
      return validateCode(
        code,
        fileType as ValidationRule["appliesTo"][number],
      );
    },
  ),
);

export default router;
