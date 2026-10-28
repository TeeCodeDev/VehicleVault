import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { initializeDatabase } from '../db/schema.js';
import { MCP_TOOL_DEFINITIONS, executeMcpTool } from './tools.js';

// Ensure DB is ready
initializeDatabase();

const server = new Server(
  {
    name: 'vehiclevault-mcp',
    version: '1.0.3',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: MCP_TOOL_DEFINITIONS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    const result = await executeMcpTool(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `MCP Tool Error: ${error?.message || 'Unknown error occurred'}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('VehicleVault MCP Server connected via stdio transport.');
}

main().catch((err) => {
  console.error('Fatal error starting VehicleVault MCP Server:', err);
  process.exit(1);
});

