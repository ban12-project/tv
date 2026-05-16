DROP INDEX "recommendations_user_source_video_unique";--> statement-breakpoint
WITH ranked_recommendations AS (
		SELECT
			ctid,
			row_number() OVER (
				PARTITION BY "user_id", "source_id", "video_id"
				ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
			) AS row_number
		FROM "recommendations"
	)
DELETE FROM "recommendations"
WHERE ctid IN (
	SELECT ctid FROM ranked_recommendations WHERE row_number > 1
);--> statement-breakpoint
CREATE INDEX "passkey_name_lower_idx" ON "passkey" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_source_video_unique" UNIQUE NULLS NOT DISTINCT("user_id","source_id","video_id");
