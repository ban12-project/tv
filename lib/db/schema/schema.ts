import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  (t) => [index("recommendations_source_video_idx").on(t.sourceId, t.videoId)],
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
  ],
);

export type SelectWatchHistory = typeof watchHistory.$inferSelect;
