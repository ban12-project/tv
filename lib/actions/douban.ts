"use server";

import { cacheTag } from "next/cache";

export interface DoubanItem {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  rating: {
    value: number;
    max: number;
    star_count: number;
    count: number;
  };
  card_subtitle: string;
  url: string;
}

export interface DoubanTop250Response {
  count: number;
  subject_collection_items: DoubanItem[];
}

export async function getDoubanTop250(
  start = 0,
  count = 12,
): Promise<DoubanItem[]> {
  "use cache";
  cacheTag("douban-top250");

  const endpoint = process.env.SUPABASE_ENDPOINT;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!endpoint || !anonKey) {
    console.error("Missing Supabase configuration for Douban action");
    return [];
  }

  try {
    const url = new URL(`${endpoint}/functions/v1/douban/top250`);
    url.searchParams.set("start", start.toString());
    url.searchParams.set("count", count.toString());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 3600, // Cache for 1 hour at the network level as well
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Douban Top 250: ${response.statusText}`);
    }

    const data: DoubanTop250Response = await response.json();
    return data.subject_collection_items;
  } catch (error) {
    console.error("Error fetching Douban Top 250:", error);
    return [];
  }
}
