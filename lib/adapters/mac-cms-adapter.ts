import type {
  MacCMSListParams,
  MacCMSVideo,
  SearchResult,
  Video,
  VideoSourceAdapter,
} from "./types";
import { getType, getVideoUniqueKey, parseEpisodes } from "./util";

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

  /**
   * Maps MacCMS video object to internal Video interface.
   * @param item MacCMSVideo object
   */
  private mapToVideo = (item: MacCMSVideo): Video => {
    const type = getType(item);

    return {
      id: item.vod_id.toString(),
      sourceId: this.id,
      sourceName: this.name,
      uniqueKey: getVideoUniqueKey({
        title: item.vod_name,
        year: item.vod_year,
        type,
      }), // Generates a composite key for de-duplication.
      title: item.vod_name,
      type,
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
      episodes: parseEpisodes(item.vod_play_url),
    };
  };

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

  /**
   * Searches for videos by keyword with streaming results.
   * @param query Search query
   * @param page Page number
   */
  async *searchStream(query: string, page = 1): AsyncGenerator<SearchResult> {
    yield* this.getVideosStream({
      wd: query,
      pg: page,
      ac: "detail",
    });
  }

  /**
   * Fetches videos using a streaming response parser to yield items as they arrive.
   */
  async *getVideosStream(
    params: MacCMSListParams,
  ): AsyncGenerator<SearchResult> {
    const apiParams: Record<string, string> = {
      ac: params.ac || "detail",
    };

    if (params.t) apiParams.t = params.t.toString();
    if (params.pg) apiParams.pg = params.pg.toString();
    if (params.wd) apiParams.wd = params.wd;
    if (params.ids) apiParams.ids = params.ids;
    if (params.pagesize) apiParams.pagesize = params.pagesize.toString();
    else if (params.limit) apiParams.pagesize = params.limit.toString();

    const url = `${this.baseUrl}?${new URLSearchParams(apiParams).toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok || !res.body) {
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasFoundList = false;
      let total = 0;
      let page = 1;
      let limit = 20;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Extract metadata if not already found
        if (total === 0) {
          const totalMatch = buffer.match(/"total":\s*(\d+)/);
          if (totalMatch) total = Number.parseInt(totalMatch[1], 10);
          const pageMatch = buffer.match(/"page":\s*(\d+)/);
          if (pageMatch) page = Number.parseInt(pageMatch[1], 10);
          const limitMatch = buffer.match(/"limit":\s*(\d+)/);
          if (limitMatch) limit = Number.parseInt(limitMatch[1], 10);
        }

        if (!hasFoundList) {
          const listStart = buffer.indexOf('"list":[');
          if (listStart !== -1) {
            hasFoundList = true;
            buffer = buffer.substring(listStart + 8);
          } else {
            // Keep small tail in case the tag is split
            if (buffer.length > 20)
              buffer = buffer.substring(buffer.length - 10);
            continue;
          }
        }

        // Lightweight object extractor
        let braceCount = 0;
        let inString = false;
        let startPos = -1;

        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          if (char === '"' && buffer[i - 1] !== "\\") inString = !inString;

          if (!inString) {
            if (char === "{") {
              if (braceCount === 0) startPos = i;
              braceCount++;
            } else if (char === "}") {
              braceCount--;
              if (braceCount === 0 && startPos !== -1) {
                const objStr = buffer.substring(startPos, i + 1);
                try {
                  const item = JSON.parse(objStr) as MacCMSVideo;
                  yield {
                    videos: [this.mapToVideo(item)],
                    total,
                    page,
                    limit,
                  };
                } catch {
                  /* Skip invalid items */
                }
                buffer = buffer.substring(i + 1);
                i = -1;
                startPos = -1;
              }
            } else if (char === "]" && braceCount === 0) {
              return;
            }
          }
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if ((e as Error).name === "AbortError") {
        console.warn(`Streaming fetch timeout for ${this.name}`);
      } else {
        console.error(`Streaming fetch error for ${this.name}:`, e);
      }
    }
  }
}
