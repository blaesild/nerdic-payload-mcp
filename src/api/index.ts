import { Router } from "express";
import { setMCPTool } from "./middleware/common.js";

// Import route handlers
import validateRouter from "./mcp/validate.js";
import queryRouter from "./mcp/query.js";
import generateRouter from "./mcp/generate.js";
import scaffoldRouter from "./mcp/scaffold.js";

const router: Router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount MCP routes
router.use("/mcp/validate", setMCPTool("validate"), validateRouter);
router.use("/mcp/query", setMCPTool("query"), queryRouter);
router.use("/mcp/generate", setMCPTool("generate"), generateRouter);
router.use("/mcp/scaffold", setMCPTool("scaffold"), scaffoldRouter);

export default router;
