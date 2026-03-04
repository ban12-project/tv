import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const zAI = createOpenAICompatible({
  name: "zAI",
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
  apiKey: process.env.OPENAI_API_KEY,
  includeUsage: true,
});

export { zAI };
