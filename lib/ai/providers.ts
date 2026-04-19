import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const workersAI = createOpenAICompatible({
  name: "workers-ai",
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  apiKey: process.env.CF_AIG_TOKEN,
  includeUsage: true,
});

const openai = createOpenAICompatible({
  name: "openai",
  baseURL: "https://router.ban12.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
  includeUsage: true,
});

export { openai, workersAI };
