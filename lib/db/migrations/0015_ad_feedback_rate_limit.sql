CREATE TABLE "ad_feedback_rate_limit" (
  "rate_limit_key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamp NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "ad_feedback_rate_limit_reset_at_idx"
  ON "ad_feedback_rate_limit" USING btree ("reset_at");
