WITH ranked_episode_metadata AS (
		SELECT
			ctid,
			row_number() OVER (
				PARTITION BY "source_id", "video_id", "metadata_key"
				ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
			) AS row_number
		FROM "episode_metadata_cache"
	)
DELETE FROM "episode_metadata_cache"
WHERE ctid IN (
	SELECT ctid FROM ranked_episode_metadata WHERE row_number > 1
);--> statement-breakpoint
WITH ranked_recommendations AS (
		SELECT
			ctid,
			row_number() OVER (
				PARTITION BY "user_id", "source_id", "video_id"
				ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
			) AS row_number
		FROM "recommendations"
		WHERE "user_id" IS NOT NULL
			AND "source_id" IS NOT NULL
			AND "video_id" IS NOT NULL
	)
DELETE FROM "recommendations"
WHERE ctid IN (
	SELECT ctid FROM ranked_recommendations WHERE row_number > 1
);--> statement-breakpoint
WITH ranked_watch_history AS (
		SELECT
			ctid,
			row_number() OVER (
				PARTITION BY "user_id", "video_id", "source_id"
				ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
			) AS row_number
		FROM "watch_history"
	)
DELETE FROM "watch_history"
WHERE ctid IN (
	SELECT ctid FROM ranked_watch_history WHERE row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "episode_metadata_source_video_key_unique" ON "episode_metadata_cache" USING btree ("source_id","video_id","metadata_key");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_user_source_video_unique" ON "recommendations" USING btree ("user_id","source_id","video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_history_user_video_source_unique" ON "watch_history" USING btree ("user_id","video_id","source_id");
