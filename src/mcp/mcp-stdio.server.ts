import { stdin, stdout } from 'node:process';

import { McpService, McpToolCallResult } from './mcp.service.js';

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const CONTENT_LENGTH_HEADER = 'content-length';

export class McpStdioServer {
  private buffer = Buffer.alloc(0);
  private running = false;
  private draining = false;

  constructor(private readonly mcpService: McpService) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    stdin.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      void this.drainBuffer();
    });
    stdin.on('end', () => {
      this.running = false;
    });
    stdin.resume();
  }

  stop(): void {
    this.running = false;
    stdin.removeAllListeners('data');
    stdin.removeAllListeners('end');
  }

  private async drainBuffer(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      while (true) {
        let message: JsonRpcRequest | null;

        try {
          message = this.readMessage();
        } catch {
          this.writeResponse({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
            },
          });
          continue;
        }

        if (!message) {
          return;
        }

        try {
          await this.handleMessage(message);
        } catch (error) {
          this.writeResponse({
            jsonrpc: '2.0',
            id: message.id ?? null,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
            },
          });
        }
      }
    } finally {
      this.draining = false;

      if (this.buffer.length > 0 && this.running) {
        void this.drainBuffer();
      }
    }
  }

  private readMessage(): JsonRpcRequest | null {
    const headerSeparator = this.buffer.indexOf('\r\n\r\n');

    if (headerSeparator < 0) {
      return null;
    }

    const headerText = this.buffer.slice(0, headerSeparator).toString('utf8');
    const contentLength = this.parseContentLength(headerText);

    if (contentLength === null) {
      this.buffer = Buffer.alloc(0);
      throw new Error('MCP request is missing a valid Content-Length header.');
    }

    const bodyStart = headerSeparator + 4;
    const bodyEnd = bodyStart + contentLength;

    if (this.buffer.length < bodyEnd) {
      return null;
    }

    const bodyBuffer = this.buffer.slice(bodyStart, bodyEnd);
    this.buffer = this.buffer.slice(bodyEnd);

    return JSON.parse(bodyBuffer.toString('utf8')) as JsonRpcRequest;
  }

  private parseContentLength(headerText: string): number | null {
    const lines = headerText.split('\r\n');

    for (const line of lines) {
      const separatorIndex = line.indexOf(':');

      if (separatorIndex < 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim().toLowerCase();

      if (key !== CONTENT_LENGTH_HEADER) {
        continue;
      }

      const rawValue = line.slice(separatorIndex + 1).trim();
      const parsed = Number.parseInt(rawValue, 10);

      return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    }

    return null;
  }

  private async handleMessage(message: JsonRpcRequest): Promise<void> {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      this.writeResponse({
        jsonrpc: '2.0',
        id: message?.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      });
      return;
    }

    if (message.method === 'initialize') {
      this.writeResponse({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result: {
          protocolVersion: this.getProtocolVersion(message.params),
          serverInfo: this.mcpService.getServerInfo(),
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      });
      return;
    }

    if (message.method === 'notifications/initialized') {
      return;
    }

    if (message.method === 'tools/list') {
      this.writeResponse({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result: {
          tools: this.mcpService.getToolDefinitions(),
        },
      });
      return;
    }

    if (message.method === 'tools/call') {
      const result = await this.handleToolCall(message.params);

      this.writeResponse({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result,
      });
      return;
    }

    if (message.method === 'ping') {
      this.writeResponse({
        jsonrpc: '2.0',
        id: message.id ?? null,
        result: {},
      });
      return;
    }

    this.writeResponse({
      jsonrpc: '2.0',
      id: message.id ?? null,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`,
      },
    });
  }

  private async handleToolCall(params: unknown): Promise<McpToolCallResult> {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return this.createToolError('Tool call parameters must be a JSON object.');
    }

    const source = params as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';

    if (!name) {
      return this.createToolError('Tool name is required.');
    }

    return this.mcpService.callTool(name, source.arguments);
  }

  private getProtocolVersion(params: unknown): string {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return '2024-11-05';
    }

    const source = params as Record<string, unknown>;

    return typeof source.protocolVersion === 'string' && source.protocolVersion.trim().length > 0
      ? source.protocolVersion.trim()
      : '2024-11-05';
  }

  private createToolError(message: string): McpToolCallResult {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    };
  }

  private writeResponse(response: JsonRpcResponse): void {
    const body = Buffer.from(JSON.stringify(response), 'utf8');

    stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    stdout.write(body);
  }
}
