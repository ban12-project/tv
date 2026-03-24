DROP INDEX "episode_metadata_lookup_idx";--> statement-breakpoint
CREATE INDEX "episode_metadata_lookup_idx" ON "episode_metadata_cache" USING btree ("source_id","video_id","metadata_key");--> statement-breakpoint
ALTER TABLE "episode_metadata_cache" DROP COLUMN "ep_index";