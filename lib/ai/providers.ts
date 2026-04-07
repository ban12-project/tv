import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const zAI = createOpenAICompatible({
  name: "zAI",
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
  apiKey: process.env.OPENAI_API_KEY,
  includeUsage: true,
});

const openai = createOpenAICompatible({
  name: "openai",
  baseURL: "https://router.ban12.com/v1",
  apiKey: process.env.BAN12_API_KEY,
  includeUsage: true,
});

export { openai, zAI };
