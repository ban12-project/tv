/**
 * Video Data from MacCMS
 */
export interface MacCMSVideo {
  vod_id: number;
  vod_name: string;
  type_name: string;
  vod_pic: string;
  vod_remarks: string;
  vod_year: string;
  vod_area: string;
  vod_director: string;
  vod_actor: string;
  vod_content: string;
  vod_play_from: string;
  vod_play_url: string;
  vod_time: string;
  vod_blurb?: string;
  vod_lang?: string;
}

/**
 * Parameters for fetching video lists.
 * Based on MacCMS V10 Provide/Vod API.
 */
export interface MacCMSListParams {
  ac?: "list" | "detail" | "videolist";
  t?: number | string; // Category ID
  pg?: number | string; // Page number
  wd?: string; // Search keyword
  h?: number | string; // Within N hours
  ids?: string; // Comma separated IDs
  year?: string; // Year
  area?: string; // Region
  lang?: string; // Language
  isend?: number | string; // 1 for finished
  limit?: number | string; // Page size (mapped to 'pagesize')
  pagesize?: number | string; // Explicit page size
}

export interface Video {
  id: string;
  sourceId: string; // ID of the API source
  sourceName: string; // Name of the API source
  uniqueKey: string; // Composite key for de-duplication
  title: string;
  type: "show" | "movie" | "tv";
  genre: string[];
  year: string;
  rating?: string;
  duration?: string;
  description: string;
  image: string;
  backgroundImage?: string;
  trailerUrl?: string;
  director?: string;
  cast?: string[];
  releaseDate?: string;
  // Dynamic properties from MoonTV/MacCMS
  vod_play_url?: string;
  vod_play_from?: string;
  episodes?: Episode[];
}

export interface Episode {
  name: string;
  url: string;
}

export interface Category {
  id: string | number;
  name: string;
  parentId?: string | number;
}

// Assuming MacCMSCategory extends or is similar to Category
export interface MacCMSCategory extends Category {
  // Add any specific properties for MacCMSCategory if known, otherwise keep it simple
  // For example:
  // macId?: string;
  // macName?: string;
}

export interface SearchResult {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
}

export interface VideoSourceAdapter {
  getDetails(id: string, sourceId?: string): Promise<Video | null>;
  searchStream(query: string, page?: number): AsyncGenerator<SearchResult>;
}
