/**
 * Vibe Kanban Better MCP Server
 *
 * A simplified MCP server for Vibe Kanban:
 * - 12 essential tools with progress notifications
 * - Resources with subscription support
 * - Task primitive for async execution tracking
 * - Project/repo locked via environment variables
 * - STDIO (default) or HTTP Streamable transport (MCP_TRANSPORT=http)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { loadConfig } from './config.js';
import { allTools } from './tools/index.js';
import { registerResourceHandlers, createSubscriptionManager } from './resources.js';

const SERVER_NAME = 'mcp-better-vibe-kanban';
const SERVER_VERSION = '3.1.1';

const toolMap = new Map(allTools.map(t => [t.name, t]));

/** Creates a configured MCP Server instance */
function createMCPServer(config: ReturnType<typeof loadConfig>) {
  const taskStore = new InMemoryTaskStore();

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        resources: { subscribe: true, listChanged: true },
        tasks: {
          list: {},
          cancel: {},
          requests: { tools: { call: {} } },
        },
      },
      taskStore,
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema) as Record<string, unknown>,
    })),
  }));

  // Call tool — pass extra to handlers for progress + task support
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
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
      return await tool.handler(validated as any, extra);
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Validation failed', details: String(e) }) }],
        isError: true,
      };
    }
  });

  // Resource handlers + subscription manager
  const subMgr = createSubscriptionManager(server, config);
  registerResourceHandlers(server, subMgr);

  return { server, subMgr };
}

async function main() {
  // Validate config (exits if env vars missing)
  const config = loadConfig();

  console.error(`[${SERVER_NAME}] Starting...`);
  console.error(`[${SERVER_NAME}] Project: ${config.projectId}`);
  console.error(`[${SERVER_NAME}] Repo: ${config.repoId}`);
  console.error(`[${SERVER_NAME}] API: ${config.baseUrl}`);

  const transportMode = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();

  if (transportMode === 'http') {
    // HTTP Streamable transport
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const { createServer: createHttpServer } = await import('node:http');
    const { randomUUID } = await import('node:crypto');

    const PORT = parseInt(process.env.MCP_PORT || '3000', 10);
    const sessions = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();

    const httpServer = createHttpServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${PORT}`);

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', name: SERVER_NAME, version: SERVER_VERSION }));
        return;
      }

      if (url.pathname === '/mcp') {
        if (req.method === 'DELETE') {
          const sessionId = req.headers['mcp-session-id'] as string | undefined;
          if (sessionId && sessions.has(sessionId)) {
            await sessions.get(sessionId)!.handleRequest(req, res);
            sessions.delete(sessionId);
          } else {
            res.writeHead(404).end('Session not found');
          }
          return;
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (sessionId && sessions.has(sessionId)) {
          await sessions.get(sessionId)!.handleRequest(req, res);
        } else if (!sessionId && req.method === 'POST') {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, transport);
              console.error(`[HTTP] Session ${id} initialized`);
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
              console.error(`[HTTP] Session ${id} closed`);
            },
          });

          const { server } = createMCPServer(config);
          await server.connect(transport);
          await transport.handleRequest(req, res);
        } else {
          res.writeHead(400).end('Bad request — missing session ID');
        }
        return;
      }

      res.writeHead(404).end('Not found');
    });

    httpServer.listen(PORT, () => {
      console.error(`🚀 ${SERVER_NAME} v${SERVER_VERSION} listening on http://localhost:${PORT}/mcp`);
    });
  } else {
    // STDIO transport (default)
    const { server, subMgr } = createMCPServer(config);

    process.on('SIGINT', () => {
      subMgr.stopPolling();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error(`🚀 ${SERVER_NAME} v${SERVER_VERSION} ready (stdio)`);
    console.error(`[${SERVER_NAME}] Tools: ${allTools.map(t => t.name).join(', ')}`);
  }
}

main().catch(e => {
  console.error(`[${SERVER_NAME}] Fatal:`, e);
  process.exit(1);
});
