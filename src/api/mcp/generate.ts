import { Router, Request, Response } from 'express';
import { generate } from '../../core/generation';
import { MCPContext } from '../../core/types';

const generateRouter = Router();

generateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const context: MCPContext = req.body;
    const result = await generate(context);
    
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export { generateRouter }; 