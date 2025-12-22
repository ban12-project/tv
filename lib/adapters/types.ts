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
  getDetails(id: string): Promise<Video | null>;
  search(query: string, page?: number): Promise<SearchResult>;
  getCategories(): Promise<Category[]>;
}
