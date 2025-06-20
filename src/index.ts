import axios from "axios";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod"; // 用于定义工具和提示的输入验证schema
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const server = new McpServer({
    name: "sendRequest", // 服务器的名称
    version: "1.0.0",         // 服务器的版本
    capabilities: {           // 声明服务器支持的能力，使客户端可以发现这些功能
        resources: {},
        tools: {},
        prompts: {},
    },
});

// 2. 暴露一个只读的“资源 (Resource)”
// 资源用于向大型语言模型（LLM）暴露数据和内容，类似于Web API中的GET请求。
// 它们不应执行显著的计算或产生副作用。
server.resource(
    "status", // 资源的内部名称
    "resource://status/server", // 资源的URI模板，这是一个固定URI，表示服务器状态
    async (uri) => {
        // 当客户端请求此资源时，返回预设的服务器状态信息。
        return {
            contents: [
                {
                    uri: uri.href,
                    text: "服务器运行正常，无已知错误。自上次启动以来已处理 100 次请求。",
                    mimeType: "text/plain"
                },
            ],
        };
    }
);
console.error("已注册资源: resource://status/server"); // 使用console.error进行日志输出，避免干

server.tool(
    "echo_message", // 工具的内部名称
    "回显您输入的任何消息", // 对人类友好的描述
    {
        // 输入参数的Zod schema，Zod是一个用于schema验证的库。
        message: z.string().describe("要回显的文本消息"), // 消息内容
    },
    async ({ message }) => {
        // 工具的执行逻辑
        return {
            content: [
                {
                    type: "text",
                    text: `你说了：${message}`, // 返回原样消息，前面加上“你说了：”
                },
            ],
        };
    }
);
console.error("已注册工具: echo_message");

const requestParamsSchema = {
 
};

// 2. 从模式推断TypeScript类型
type RequestParams = {
  uri: string;
  params: Record<string, unknown>;
  headers?: Record<string, string>;
};

// 3. 注册工具
server.tool(
  "send-get-request",
  "发送HTTP GET请求并返回响应数据",
    {
    uri: z.string().url().describe("完整的请求URL"),
    params: z.record(z.unknown()).describe("请求参数对象，如 {id: 1}"),
    headers: z.record(z.string()).optional().describe("请求头信息")
    },
  async (args: RequestParams, { sendNotification }): Promise<CallToolResult> => {
    // 使用类型安全的参数
    const { uri, params, headers } = args;
    try {
      const response = await axios.get(uri, {
        params,
        headers: headers || {},
        timeout: 10000
      });

      return {
        content: [{
          type: "text",
          text: `请求成功: ${JSON.stringify(response.data.data)}`,
        }]
      };
    } catch (error) {
        // ... 错误处理 ...
        return {
            content: [{
              type: "text",
              text: `请求错误 (${error})`,
            }]
         };
    }
  }
);

// 4. 定义一个“提示 (Prompt)”
// 提示是可重用的模板，旨在帮助LLM与服务器有效互动，通常由用户控制，以UI元素（如斜杠命令）的形式呈现。
server.prompt(
    "generate_slogan", // 提示的内部名称
    "为给定主题生成一句口号", // 对人类友好的描述
    {
        theme: z.string().describe("口号的主题，例如“环保”或“创新”"),
    },
    ({ theme }) => {
        // 返回一个消息数组，指导LLM如何生成口号
        return {
            messages: [
                {
                    role: "user", // 消息角色，这里模拟用户对LLM的请求
                    content: {
                        type: "text",
                        text: `请为“${theme}”主题生成一句有创意且吸引人的口号。要求口号简短有力，易于传播。`,
                    },
                },
            ],
        };
    }
);
console.error("已注册提示: generate_slogan");


// 5. 启动服务器并连接到Stdio传输
// Stdio传输通过标准输入/输出来通信，适用于本地进程和命令行工具。
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP演示服务器已成功启动，并监听Stdio传输。"); // 使用console.error避免干扰Stdio通信
}

// 捕获可能发生的致命错误
main().catch((error) => {
    console.error("服务器启动时发生致命错误:", error);
    process.exit(1); // 以非零退出码表示错误
});
