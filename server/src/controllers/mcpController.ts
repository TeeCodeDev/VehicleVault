import { Request, Response } from 'express';
import { MCP_TOOL_DEFINITIONS, executeMcpTool } from '../mcp/tools.js';

export class McpController {
  public static async listTools(_req: Request, res: Response): Promise<void> {
    res.json({ tools: MCP_TOOL_DEFINITIONS });
  }

  public static async execute(req: Request, res: Response): Promise<void> {
    const { tool, arguments: args } = req.body;

    if (!tool) {
      res.status(400).json({ error: 'Missing tool parameter' });
      return;
    }

    try {
      const result = await executeMcpTool(tool, args || {}, req.user?.userId);
      res.json({
        success: true,
        tool,
        result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Error executing MCP tool',
      });
    }
  }

  public static async sseEndpoint(req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial handshake
    res.write(`event: endpoint\ndata: ${JSON.stringify({ endpoint: '/api/mcp/execute' })}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  }
}

