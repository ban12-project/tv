import { embed, embedMany } from "ai";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { embeddingModel } from "@/lib/ai/providers";
import { db } from "../db/queries";
import { embeddings } from "../db/schema/embeddings";

export const generateChunks = (input: string): string[] => {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "sentence" });
  return Array.from(segmenter.segment(input))
    .map((s) => s.segment.trim())
    .filter((s) => s.length > 1); // Filter out empty strings and single punctuation marks
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
  const similarGuides = await db
    .select({ name: embeddings.content, similarity })
    .from(embeddings)
    .where(gt(similarity, 0.5))
    .orderBy((t) => desc(t.similarity))
    .limit(4);
  return similarGuides;
};
