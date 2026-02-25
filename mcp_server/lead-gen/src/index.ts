
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apolloTools, handleApolloTool } from "./tools/apollo.js";
import { prospeoTools, handleProspeoTool } from "./tools/prospeo.js";
import dotenv from "dotenv";

dotenv.config();

const server = new Server(
    {
        name: "lead-gen-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            ...apolloTools,
            ...prospeoTools,
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        const apolloResult = await handleApolloTool(name, args);
        if (apolloResult) return apolloResult;

        const prospeoResult = await handleProspeoTool(name, args);
        if (prospeoResult) return prospeoResult;

        throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
        console.error(`Error executing tool ${name}:`, error);
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
        };
    }
});

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Lead Gen MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
