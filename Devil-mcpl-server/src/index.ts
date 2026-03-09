#!/usr/bin/env node

/**
 * MCP Server for GitHub Codespaces
 * TypeScript implementation with stdio transport
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Server setup
const server = new Server(
  {
    name: "codespace-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============= TOOL SCHEMAS =============

const CalculateArgsSchema = z.object({
  expression: z.string().describe("Mathematical expression to evaluate"),
});

const ReverseStringArgsSchema = z.object({
  text: z.string().describe("String to reverse"),
});

const CountWordsArgsSchema = z.object({
  text: z.string().describe("Text to analyze"),
});

const ListFilesArgsSchema = z.object({
  path: z.string().default(".").describe("Directory path"),
});

const ExecCommandArgsSchema = z.object({
  command: z.string().describe("Command to execute"),
  cwd: z.string().optional().describe("Working directory"),
});

// ============= TOOL HANDLERS =============

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "calculate",
      description: "Evaluate a mathematical expression safely",
      inputSchema: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Math expression (e.g., '2 + 2 * 3')",
          },
        },
        required: ["expression"],
      },
    },
    {
      name: "reverse_string",
      description: "Reverse a string",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to reverse" },
        },
        required: ["text"],
      },
    },
    {
      name: "count_words",
      description: "Count words, characters, and lines in text",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to analyze" },
        },
        required: ["text"],
      },
    },
    {
      name: "list_files",
      description: "List files in a directory with metadata",
      inputSchema: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Directory path",
            default: "." 
          },
        },
      },
    },
    {
      name: "get_system_info",
      description: "Get system information from Codespace",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "execute_command",
      description: "Execute a shell command (use with caution)",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command to execute" },
          cwd: { type: "string", description: "Working directory" },
        },
        required: ["command"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "calculate": {
        const { expression } = CalculateArgsSchema.parse(args);
        try {
          // Safe evaluation using Function constructor
          const fn = new Function('return (' + expression + ')');
          const result = fn();
          return {
            content: [{ 
              type: "text", 
              text: `Result: ${result}` 
            }],
          };
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: ${error.message}` 
            }],
          };
        }
      }

      case "reverse_string": {
        const { text } = ReverseStringArgsSchema.parse(args);
        return {
          content: [{ 
            type: "text", 
            text: text.split('').reverse().join('') 
          }],
        };
      }

      case "count_words": {
        const { text } = CountWordsArgsSchema.parse(args);
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              words: words.length,
              characters: text.length,
              lines: text.split('\n').length,
              unique_words: uniqueWords.size,
            }, null, 2)
          }],
        };
      }

      case "list_files": {
        const { path: dirPath } = ListFilesArgsSchema.parse(args);
        try {
          const files = await fs.readdir(dirPath);
          const fileDetails = await Promise.all(
            files.map(async (file) => {
              const fullPath = path.join(dirPath, file);
              const stat = await fs.stat(fullPath);
              return {
                name: file,
                type: stat.isDirectory() ? 'directory' : 'file',
                size: stat.size,
                modified: stat.mtime.toISOString(),
              };
            })
          );
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(fileDetails, null, 2)
            }],
          };
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: ${error.message}` 
            }],
          };
        }
      }

      case "get_system_info": {
        const info = {
          hostname: os.hostname(),
          platform: os.platform(),
          release: os.release(),
          architecture: os.arch(),
          cpus: os.cpus().length,
          memory: {
            total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
            free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
          },
          codespace: process.env.CODESPACE_NAME || 'Not in Codespace',
          cwd: process.cwd(),
          uptime: Math.round(os.uptime() / 60) + ' minutes',
        };
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(info, null, 2)
          }],
        };
      }

      case "execute_command": {
        const { command, cwd } = ExecCommandArgsSchema.parse(args);
        try {
          const { stdout, stderr } = await execAsync(command, { 
            cwd: cwd || process.cwd(),
            shell: '/bin/bash',
            timeout: 30000,
          });
          return {
            content: [{ 
              type: "text", 
              text: stdout || stderr || 'Command executed successfully'
            }],
          };
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: ${error.message}` 
            }],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: `Error: ${error.message}` 
      }],
    };
  }
});

// ============= RESOURCES =============

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "system://info",
      name: "System Information",
      description: "Current system information",
      mimeType: "application/json",
    },
    {
      uri: "docs://readme",
      name: "Server Documentation",
      description: "MCP server documentation",
      mimeType: "text/markdown",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  if (uri === "system://info") {
    const info = {
      hostname: os.hostname(),
      platform: os.platform(),
      codespace: process.env.CODESPACE_NAME || 'local',
      node_version: process.version,
    };
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify(info, null, 2),
      }],
    };
  }
  
  if (uri === "docs://readme") {
    const readme = `# MCP Server in Codespaces

## Available Tools
- calculate - Math evaluation
- reverse_string - String reversal
- count_words - Text analysis
- list_files - Directory listing
- get_system_info - System details
- execute_command - Run shell commands

## Usage
Connect using any MCP client and start using these tools!`;
    
    return {
      contents: [{
        uri: uri,
        mimeType: "text/markdown",
        text: readme,
      }],
    };
  }
  
  throw new Error(`Resource not found: ${uri}`);
});

// ============= START SERVER =============

async function main() {
  console.error('Starting MCP server in stdio mode...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
