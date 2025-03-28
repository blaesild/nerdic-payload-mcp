import { Router, Request } from "express";
import {
  scaffoldProject,
  validateScaffoldOptions,
} from "@/core/scaffolding.js";
import { ScaffoldProjectConfig } from "@/core/types.js";
import { handleMCPRequest } from "@/api/middleware/common.js";
import { ValidationError } from "@/api/middleware/errorHandler.js";

const router = Router();

// POST /api/mcp/scaffold/project
router.post(
  "/project",
  handleMCPRequest(async (req: Request): Promise<Record<string, string>> => {
    const config = req.body as ScaffoldProjectConfig;
    // Basic validation, more robust validation is in validateScaffoldOptions
    if (
      !config ||
      typeof config !== "object" ||
      !config.projectName ||
      !config.dbAdapter
    ) {
      throw new ValidationError(
        "Invalid parameters for scaffoldProject. Minimum required: projectName, dbAdapter.",
      );
    }
    // Optionally run validation first
    const validationResult = await validateScaffoldOptions(config);
    if (!validationResult.isValid) {
      throw new ValidationError(
        `Invalid scaffold options: ${validationResult.errors.join(", ")}`,
      );
    }
    return scaffoldProject(config);
  }),
);

// POST /api/mcp/scaffold/validate
router.post(
  "/validate",
  handleMCPRequest(
    async (req: Request): Promise<{ isValid: boolean; errors: string[] }> => {
      const options = req.body as ScaffoldProjectConfig;
      if (!options || typeof options !== "object") {
        throw new ValidationError(
          "Invalid request body: Expected a configuration object.",
        );
      }
      return validateScaffoldOptions(options);
    },
  ),
);

export default router;
