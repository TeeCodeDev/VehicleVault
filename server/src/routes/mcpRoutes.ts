import { Router } from 'express';
import { McpController } from '../controllers/mcpController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Allow authorization either via standard Bearer token or vkv_ API key
router.use(requireAuth);

router.get('/tools', McpController.listTools);
router.post('/execute', McpController.execute);
router.get('/sse', McpController.sseEndpoint);

export default router;

