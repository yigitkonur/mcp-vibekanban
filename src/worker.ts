/**
 * Cloudflare Workers entry point for Vibe Kanban MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { allTools } from './tools/index.js';

export class BetterVibeKanbanMCP extends McpAgent {
  server = new McpServer({
    name: 'mcp-better-vibe-kanban',
    version: '3.1.1',
  });

  async init() {
    for (const tool of allTools) {
      const jsonSchema = zodToJsonSchema(tool.inputSchema) as Record<string, unknown>;
      this.server.tool(
        tool.name,
        tool.description,
        jsonSchema,
        async (args: Record<string, unknown>) => {
          try {
            const validated = tool.inputSchema.parse(args);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await tool.handler(validated as any, {} as any);
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        },
      );
    }
  }
}

export default {
  fetch(request: Request, env: unknown, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', name: 'mcp-better-vibe-kanban', version: '3.1.1' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.pathname === '/mcp' || url.pathname === '/sse' || url.pathname === '/message') {
      return BetterVibeKanbanMCP.serve('/mcp').fetch(request, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },
};
