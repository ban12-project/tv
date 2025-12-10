"use server";

import { z } from "zod";
import { sourceProvider } from "@/lib/source-provider";

const searchSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query is too long"),
});

export async function fetchHomeContent() {
  try {
    const data = await sourceProvider.getHomeModules();
    return data;
  } catch (error) {
    console.error("Error fetching home content:", error);
    // Return empty fallback
    return { trending: [], newReleases: [], featured: [] };
  }
}

export async function fetchVideoDetails(id: string) {
  try {
    const video = await sourceProvider.getDetails(id);
    return video;
  } catch (error) {
    console.error(`Error fetching details for ${id}:`, error);
    return null;
  }
}

export async function searchVideos(_prevState: unknown, formData: FormData) {
  const query = formData.get("query");

  const validated = searchSchema.safeParse({ query });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      results: [],
    };
  }

  try {
    const results = await sourceProvider.search(validated.data.query);
    return {
      errors: null,
      results: results.videos,
    };
  } catch (error) {
    console.error("Search error:", error);
    return {
      errors: { query: ["An unexpected error occurred"] },
      results: [],
    };
  }
}

export async function quickSearch(query: string) {
  try {
    if (!query) return [];
    const results = await sourceProvider.search(query);
    return results.videos;
  } catch (error) {
    console.error("Quick search error:", error);
    return [];
  }
}
export async function getTrending() {
  try {
    const modules = await sourceProvider.getHomeModules();
    return modules.trending;
  } catch (error) {
    console.error("Error fetching trending content:", error);
    return [];
  }
}
