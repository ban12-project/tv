DROP INDEX IF EXISTS "embeddingIndex";--> statement-breakpoint
DELETE FROM "embeddings";--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "embedding" TYPE vector(1024);--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
