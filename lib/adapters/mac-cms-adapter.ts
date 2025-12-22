import type {
  Category,
  SearchResult,
  Video,
  VideoSourceAdapter,
} from "./types";

/**
 * Response structure from MacCMS V10 API.
 * Corresponds to the standard JSON return format.
 */
interface MacCMSResponse {
  code: number;
  msg: string;
  page: number | string;
  pagecount: number | string;
  limit: number | string;
  total: number | string;
  list: MacCMSVideo[];
  class?: MacCMSCategory[]; // Categories are often returned when ac=list
}

/**
 * Video Category Data
 */
export interface MacCMSCategory {
  type_id: number;
  type_name: string;
  type_pid?: number;
}

/**
 * Video Data from MacCMS
 */
interface MacCMSVideo {
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

/**
 * Adapter for MacCMS V10 based APIs.
 * Supports standard Provide API interactions.
 */
export class MacCMSAdapter implements VideoSourceAdapter {
  private baseUrl: string;
  private id: string;
  private name: string;

  /**
   * @param baseUrl The full URL to the API endpoint (e.g., https://example.com/api.php/provide/vod/)
   * @param id The source ID
   * @param name The source name
   */
  constructor(
    baseUrl: string,
    id: string = "unknown",
    name: string = "Unknown Source",
  ) {
    this.baseUrl = baseUrl;
    this.id = id;
    this.name = name;
  }

  /**
   * Generic fetcher for MacCMS API.
   * @param params Query parameters
   */
  private async fetchAPI(
    params: Record<string, string>,
  ): Promise<MacCMSResponse> {
    const searchParams = new URLSearchParams(params);
    const url = `${this.baseUrl}?${searchParams.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch from MacCMS: ${res.statusText}`);
      }
      return await res.json();
    } catch {
      // console.error("MacCMS API Error:", error);
      return {
        code: 500,
        msg: "Error",
        page: 1,
        pagecount: 0,
        limit: 20,
        total: 0,
        list: [],
      };
    }
  }

  private getType(item: MacCMSVideo) {
    const isMovie =
      item.type_name === "电影" ||
      this.parseEpisodes(item.vod_play_url).length <= 1;
    const type = isMovie ? "movie" : "tv";
    return type;
  }

  /**
   * Generates a composite key for de-duplication.
   */
  private getUniqueKey(item: MacCMSVideo): string {
    const type = this.getType(item);
    // heuristic: type_name might be chinese.
    // Using episode count is safer if type_name is unreliable.
    // Also match MultiSourceProvider logic:
    // `${video.title.replaceAll(" ", "")}-${video.year || "unknown"}-${video.episodes && video.episodes.length === 1 ? "movie" : "tv"}`

    // We can just rely on the same logic if we map first. But we need key inside map.
    // Let's replicate strict logic:
    const title = item.vod_name.replaceAll(" ", "");
    const year = item.vod_year || "unknown";
    return `${title}-${year}-${type}`;
  }

  /**
   * Maps MacCMS video object to internal Video interface.
   * @param item MacCMSVideo object
   */
  private mapToVideo = (item: MacCMSVideo): Video => {
    return {
      id: item.vod_id.toString(),
      sourceId: this.id,
      sourceName: this.name,
      uniqueKey: this.getUniqueKey(item),
      title: item.vod_name,
      type: this.getType(item),
      genre: [item.type_name],
      year: item.vod_year,
      description: item.vod_content
        ? item.vod_content.replace(/<[^>]*>/g, "").trim()
        : "", // Remove HTML tags
      image: item.vod_pic.replace(/^http:\/\//i, "https://"),
      backgroundImage: item.vod_pic.replace(/^http:\/\//i, "https://"), // Fallback
      director: item.vod_director,
      cast: item.vod_actor ? item.vod_actor.split(",") : [],
      vod_play_url: item.vod_play_url.replace(/^http:\/\//i, "https://"),
      vod_play_from: item.vod_play_from,
      episodes: this.parseEpisodes(item.vod_play_url),
    };
  };

  /**
   * Parses video play URLs into structured episodes.
   * Supports `$` delimited formats and `#` delimited lists.
   * @param playUrl The raw play URL string from API
   */
  private parseEpisodes(playUrl: string): { name: string; url: string }[] {
    let episodes: string[] = [];

    if (playUrl) {
      const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
      // Split by $$$ to handle multiple sources/playlists
      const vod_play_url_array = playUrl.split("$$$");

      // Find the segment with the most m3u8 matches
      vod_play_url_array.forEach((url: string) => {
        const matches = url.match(m3u8Regex) || [];
        if (matches.length > episodes.length) {
          episodes = matches;
        }
      });
    }

    if (episodes.length > 0) {
      return Array.from(new Set(episodes)).map(
        (link: string, index: number) => {
          let cleanLink = link.substring(1); // Remove leading $
          const parenIndex = cleanLink.indexOf("(");
          if (parenIndex > 0) {
            cleanLink = cleanLink.substring(0, parenIndex);
          }

          return {
            name: `Episode ${index + 1}`,
            url: cleanLink.replace(/^http:\/\//i, "https://"),
          };
        },
      );
    }

    // Fallback/Legacy parsing if regex logic yields nothing
    if (playUrl) {
      return playUrl
        .split("#")
        .map((segment) => {
          const parts = segment.split("$");
          if (parts.length >= 2) {
            return {
              name: parts[0],
              url: parts[1].replace(/^http:\/\//i, "https://"),
            };
          }
          return {
            name: `Episode ${playUrl.split("#").indexOf(segment) + 1}`,
            url: segment.replace(/^http:\/\//i, "https://"),
          };
        })
        .filter(
          (ep) =>
            ep.url && (ep.url.startsWith("http") || ep.url.startsWith("//")),
        );
    }

    return [];
  }

  /**
   * Fetches videos with advanced filtering.
   * @param params MacCMSListParams
   */
  async getVideos(params: MacCMSListParams): Promise<SearchResult> {
    const apiParams: Record<string, string> = {
      ac: params.ac || "detail",
    };

    if (params.t) apiParams.t = params.t.toString();
    if (params.pg) apiParams.pg = params.pg.toString();
    if (params.wd) apiParams.wd = params.wd;
    if (params.h) apiParams.h = params.h.toString();
    if (params.ids) apiParams.ids = params.ids;
    if (params.year) apiParams.year = params.year;
    if (params.area) apiParams.area = params.area;
    if (params.lang) apiParams.lang = params.lang;
    if (params.isend) apiParams.isend = params.isend.toString();
    if (params.pagesize) apiParams.pagesize = params.pagesize.toString();
    else if (params.limit) apiParams.pagesize = params.limit.toString();

    const response = await this.fetchAPI(apiParams);

    if (!response.list) {
      return {
        videos: [],
        total: 0,
        page: 1,
        limit: 20,
      };
    }

    return {
      videos: response.list.map(this.mapToVideo),
      total: Number(response.total),
      page: Number(response.page),
      limit: Number(response.limit),
    };
  }
  /**
   * Fetches the list of video categories.
   */
  async getCategories(): Promise<Category[]> {
    // ac=list usually returns the category list in the 'class' field
    const response = await this.fetchAPI({ ac: "list" });
    const classes = response.class || [];
    return classes.map((c: MacCMSCategory) => ({
      id: c.type_id,
      name: c.type_name,
      parentId: c.type_pid,
    }));
  }

  /**
   * Fetches details for a specific video ID.
   * @param id The video ID
   */
  async getDetails(id: string): Promise<Video | null> {
    const response = await this.fetchAPI({ ac: "detail", ids: id });
    if (response.list && response.list.length > 0) {
      return this.mapToVideo(response.list[0]);
    }
    return null;
  }

  /**
   * Searches for videos by keyword.
   * @param query Search query
   * @param page Page number
   */
  async search(query: string, page = 1): Promise<SearchResult> {
    return this.getVideos({
      wd: query,
      pg: page,
      ac: "detail",
    });
  }
}
