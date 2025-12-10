export interface Video {
  id: string;
  title: string;
  type: "show" | "movie";
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

export interface SearchResult {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
}

export interface VideoSourceAdapter {
  getHomeModules(): Promise<{
    trending: Video[];
    newReleases: Video[];
    featured: Video[];
  }>;
  getDetails(id: string): Promise<Video | null>;
  search(query: string, page?: number): Promise<SearchResult>;
}
