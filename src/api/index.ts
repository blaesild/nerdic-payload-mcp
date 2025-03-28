import { Router } from "express";
import { setMCPTool } from "./middleware/common.js"; // Correct path

// Import route handlers
import validateRoutes from "./mcp/validate.js";
import queryRoutes from "./mcp/query.js";
import generateRoutes from "./mcp/generate.js";
import scaffoldRoutes from "./mcp/scaffold.js";

const router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Group MCP routes and apply tool name middleware
router.use("/mcp/validate", setMCPTool("validate"), validateRoutes);
router.use("/mcp/query", setMCPTool("query"), queryRoutes);
router.use("/mcp/generate", setMCPTool("generate"), generateRoutes);
router.use("/mcp/scaffold", setMCPTool("scaffold"), scaffoldRoutes);

export default router;
