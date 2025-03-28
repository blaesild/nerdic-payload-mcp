import dotenv from "dotenv"; // Use import for ESM
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root
const envResult = dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (envResult.error) {
  console.error("Error loading .env file:", envResult.error);
  process.exit(1); // Exit if we can't load environment variables
}

// Initialize environment
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required but not found in environment variables");
  process.exit(1);
}

console.log("Environment variables loaded successfully");

// Now import the rest of the dependencies after env vars are loaded
import express from "express";
import cors from "cors";
import apiRouter from "./api/index.js"; // Main API router
import { errorHandler } from "./api/middleware/errorHandler.js"; // Error handler
import { initializeOpenAI } from "./core/generation.js";

// Initialize OpenAI client
if (!initializeOpenAI()) {
  console.error("Failed to initialize OpenAI client");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 8080;

// --- Middleware ---

// CORS
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN || "*", // Use env var or default
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"], // Allow common methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allow common headers
};
app.use(cors(corsOptions));
// Explicitly handle OPTIONS requests for CORS preflight
app.options("*", cors(corsOptions));

// Body Parsing
app.use(express.json({ limit: "5mb" })); // Allow larger bodies for code/context
app.use(express.urlencoded({ extended: true }));

// --- API Routes ---
app.use("/api", apiRouter); // Mount all API routes under /api

// --- Default Route (Optional) ---
app.get("/", (req, res) => {
  res.send("MCP Server is running!");
});

// --- Error Handler ---
// Must be the LAST piece of middleware
app.use(errorHandler);

// --- Start Server ---
app.listen(port, () => {
  console.log(`MCP Server listening on port ${port}`);
  console.log(`CORS Origin configured for: ${corsOptions.origin}`);
});

// Optional: Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  // Add cleanup logic if needed
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  // Add cleanup logic if needed
  process.exit(0);
});

export default app; // Export app for potential testing or Vercel serverless entry
