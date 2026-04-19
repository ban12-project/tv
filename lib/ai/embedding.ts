import "server-only";
import { embed, embedMany } from "ai";
import { cosineDistance, sql } from "drizzle-orm";
import {
  EMBEDDING_MODEL_ID,
  embeddingProviderOptions,
  generateChunks,
} from "@/lib/ai/embedding-config";
import { workersAI } from "@/lib/ai/providers";
import { findRelevantContentQuery } from "../db/queries";
import { embeddings } from "../db/schema/embeddings";

const embeddingModel = workersAI.embeddingModel(EMBEDDING_MODEL_ID);

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
    providerOptions: embeddingProviderOptions,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\\n", " ");
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
    providerOptions: embeddingProviderOptions,
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
