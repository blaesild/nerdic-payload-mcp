import { Router } from 'express';
import { generateRouter } from './mcp/generate';
import { queryRouter } from './mcp/query';
import { scaffoldRouter } from './mcp/scaffold';
import { validateRouter } from './mcp/validate';

const router = Router();

// MCP routes
router.use('/mcp/generate', generateRouter);
router.use('/mcp/query', queryRouter);
router.use('/mcp/scaffold', scaffoldRouter);
router.use('/mcp/validate', validateRouter);

export { router }; 