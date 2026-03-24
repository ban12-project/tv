CREATE TABLE "episode_metadata_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"video_id" text NOT NULL,
	"ep_index" integer NOT NULL,
	"metadata_key" text NOT NULL,
	"resource_url" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "episode_metadata_lookup_idx" ON "episode_metadata_cache" USING btree ("source_id","video_id","ep_index","metadata_key");