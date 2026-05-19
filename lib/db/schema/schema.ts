import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const apiSource = pgTable("api_source", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").default("json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type SelectApiSource = typeof apiSource.$inferSelect;

export const recommendations = pgTable(
  "recommendations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description").notNull(),
    image: text("image").notNull(),
    sourceId: text("source_id").references(() => apiSource.id, {
      onDelete: "set null",
    }), // Optional
    videoId: text("video_id"), // Optional
    epIndex: text("ep_index"), // Optional
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("recommendations_source_video_idx").on(t.sourceId, t.videoId),
    unique("recommendations_user_source_video_unique")
      .on(t.userId, t.sourceId, t.videoId)
      .nullsNotDistinct(),
  ],
);

export type SelectRecommendation = typeof recommendations.$inferSelect;

export const watchHistory = pgTable(
  "watch_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    sourceId: text("source_id").notNull(),
    epIndex: integer("ep_index").notNull(),
    progress: integer("progress").notNull().default(0), // Progress in seconds
    duration: integer("duration").notNull().default(0), // Total duration in seconds
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("watch_history_lookup_idx").on(t.userId, t.videoId, t.sourceId),
    uniqueIndex("watch_history_user_video_source_unique").on(
      t.userId,
      t.videoId,
      t.sourceId,
    ),
  ],
);

export type SelectWatchHistory = typeof watchHistory.$inferSelect;

export const episodeMetadataCache = pgTable(
  "episode_metadata_cache",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text("source_id").notNull(),
    videoId: text("video_id").notNull(),
    metadataKey: text("metadata_key").notNull(),
    resourceUrl: text("resource_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("episode_metadata_lookup_idx").on(
      t.sourceId,
      t.videoId,
      t.metadataKey,
    ),
    uniqueIndex("episode_metadata_source_video_key_unique").on(
      t.sourceId,
      t.videoId,
      t.metadataKey,
    ),
  ],
);

export type SelectEpisodeMetadataCache =
  typeof episodeMetadataCache.$inferSelect;

export const adFeedbackRateLimit = pgTable(
  "ad_feedback_rate_limit",
  {
    rateLimitKey: text("rate_limit_key").primaryKey(),
    count: integer("count").default(0).notNull(),
    resetAt: timestamp("reset_at").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("ad_feedback_rate_limit_reset_at_idx").on(t.resetAt)],
);
