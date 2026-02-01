/**
 * Vibe Kanban Better MCP Server
 * 
 * A simplified MCP server for Vibe Kanban:
 * - 6 essential tools (reduced from 13)
 * - Project/repo locked via environment variables
 * - STDIO transport (use MCP proxy for remote access)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { loadConfig } from './config.js';
import { allTools } from './tools/index.js';

const toolMap = new Map(allTools.map(t => [t.name, t]));

async function main() {
  // Validate config (exits if env vars missing)
  const config = loadConfig();
  
  console.error('[vibe-kanban-mcp] Starting...');
  console.error(`[vibe-kanban-mcp] Project: ${config.projectId}`);
  console.error(`[vibe-kanban-mcp] Repo: ${config.repoId}`);
  console.error(`[vibe-kanban-mcp] API: ${config.baseUrl}`);

  const server = new Server(
    { name: 'vibe-kanban-better-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema) as Record<string, unknown>,
    })),
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);
    
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      const validated = tool.inputSchema.parse(args || {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await tool.handler(validated as any);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Validation failed', details: String(e) }) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`[vibe-kanban-mcp] Ready. Tools: ${allTools.map(t => t.name).join(', ')}`);
}

main().catch(e => {
  console.error('[vibe-kanban-mcp] Fatal:', e);
  process.exit(1);
});
