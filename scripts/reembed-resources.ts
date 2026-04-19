import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { neon } from "@neondatabase/serverless";
import { embedMany } from "ai";
import { customAlphabet } from "nanoid";

const EMBEDDING_MODEL_ID = "@cf/qwen/qwen3-embedding-0.6b";
const EMBEDDING_DIMENSIONS = 1024;
const embeddingProviderOptions = {
  "workers-ai": {
    dimensions: EMBEDDING_DIMENSIONS,
  },
} as const;

type Resource = {
  id: string;
  content: string;
};

const generateChunks = (input: string): string[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (trimmed.length < 4000) {
    return [trimmed];
  }

  const chunks: string[] = [];
  const lines = trimmed.split(/\n+/);
  let currentChunk = "";

  for (const line of lines) {
    if (`${currentChunk}\n${line}`.length > 2000) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

const sql = neon(databaseUrl);
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

const workersAI = createOpenAICompatible({
  name: "workers-ai",
  apiKey: process.env.CF_AIG_TOKEN,
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
});

const embeddingModel = workersAI.embeddingModel(EMBEDDING_MODEL_ID);

function toVectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} embedding dimensions, got ${embedding.length}`,
    );
  }

  return `[${embedding.join(",")}]`;
}

async function main() {
  const resources = (await sql`
    SELECT id, content
    FROM resources
    ORDER BY created_at ASC
  `) as Resource[];

  console.log(`Re-embedding ${resources.length} resources with ${EMBEDDING_MODEL_ID}`);

  let inserted = 0;

  for (const resource of resources) {
    const chunks = generateChunks(resource.content);
    if (chunks.length === 0) continue;

    const result = await embedMany({
      model: embeddingModel,
      values: chunks,
      providerOptions: embeddingProviderOptions,
    });

    for (const [index, embedding] of result.embeddings.entries()) {
      await sql`
        INSERT INTO embeddings (id, resource_id, content, embedding)
        VALUES (
          ${nanoid()},
          ${resource.id},
          ${chunks[index]},
          ${toVectorLiteral(embedding)}::vector
        )
      `;
      inserted += 1;
    }

    console.log(`Embedded resource ${resource.id} into ${chunks.length} chunks`);
  }

  console.log(`Done. Inserted ${inserted} embeddings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
