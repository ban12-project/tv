import "server-only";
import { embed, embedMany } from "ai";
import { cosineDistance, sql } from "drizzle-orm";
import { zAI } from "@/lib/ai/providers";
import { findRelevantContentQuery } from "../db/queries";
import { embeddings } from "../db/schema/embeddings";

const embeddingModel = zAI.embeddingModel("embedding-3-pro");

export const generateChunks = (input: string): string[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // 1. Priority: Keep Integrity
  if (trimmed.length < 4000) {
    return [trimmed];
  }

  // 2. Fallback: Split by lines/paragraphs
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

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
    providerOptions: {
      zAI: {
        dimensions: 1536,
      },
    },
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\\n", " ");
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
    providerOptions: {
      zAI: {
        dimensions: 1536,
      },
    },
  });
  return embedding;
};

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;
  return await findRelevantContentQuery(similarity);
};
