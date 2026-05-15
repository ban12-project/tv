import { inferContentProfile } from "@/lib/content-profile";
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
    } catch (error) {
      console.error("MacCMS API Error:", error);
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
    const episodes = parseEpisodes(item.vod_play_url);
    const type = getType(item);
    const contentProfile = inferContentProfile({
      title: item.vod_name,
      genre: [item.type_name],
      description: item.vod_content ?? "",
      episodes,
      remarks: item.vod_remarks,
      blurb: item.vod_blurb,
    });

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
      episodes,
      remarks: item.vod_remarks,
      blurb: item.vod_blurb,
      contentKind: contentProfile.kind,
      contentConfidence: contentProfile.confidence,
      contentSignals: contentProfile.signals,
    };
  };

  /**
   * Fetches videos with advanced filtering.
   * @param params MacCMSListParams
   */
  private async getVideos(params: MacCMSListParams): Promise<SearchResult> {
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
  private async *getVideosStream(
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

      let total = 0;
      let page = 1;
      let limit = 20;

      for await (const event of parseMacCMSResponse(decodeStream(reader))) {
        if (event.kind === "metadata") {
          total = event.total;
          page = event.page;
          limit = event.limit;
        } else if (event.kind === "item") {
          yield {
            videos: [this.mapToVideo(event.value)],
            total,
            page,
            limit,
          };
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

type ParseEvent =
  | { kind: "metadata"; total: number; page: number; limit: number }
  | { kind: "item"; value: MacCMSVideo };

/**
 * Decodes a byte stream into a string stream.
 */
async function* decodeStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        yield decoder.decode(value, { stream: true });
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Standalone generator to parse MacCMS JSON stream.
 * Yields metadata events and item events.
 */
async function* parseMacCMSResponse(
  stream: AsyncIterable<string>,
): AsyncGenerator<ParseEvent> {
  // State machine variables global to the stream
  let buffer = "";
  let inList = false;
  let metadataParsed = false;

  // Track metadata to yield it once
  let total = 0;
  let page = 1;
  let limit = 20;

  for await (const chunk of stream) {
    buffer += chunk;

    // Try to find the "list" array start if not yet found
    if (!inList) {
      const listMatch = buffer.match(/"list"\s*:\s*\[/);
      if (listMatch) {
        inList = true;
        // Capture metadata before the list using a simpler regex fallback
        if (!metadataParsed) {
          const preList = buffer.substring(0, listMatch.index);
          const totalMatch = preList.match(/"total":\s*(\d+)/);
          if (totalMatch) total = Number.parseInt(totalMatch[1], 10);
          const pageMatch = preList.match(/"page":\s*(\d+)/);
          if (pageMatch) page = Number.parseInt(pageMatch[1], 10);
          const limitMatch = preList.match(/"limit":\s*(\d+)/);
          if (limitMatch) limit = Number.parseInt(limitMatch[1], 10);

          metadataParsed = true;
          yield { kind: "metadata", total, page, limit };
        }

        // Advance buffer to start of the first item inside the list
        const startIndex = (listMatch.index || 0) + listMatch[0].length;
        buffer = buffer.substring(startIndex);
      } else {
        // Keep a sliding window for metadata and list tag
        // But don't discard too much if we haven't found list yet
        if (buffer.length > 1024) {
          // Prevent infinite buffer growth if "list" is never found
          // Keep last 512 chars for potential split match
          buffer = buffer.slice(-512);
        }
      }
    }

    if (inList) {
      let processedIndex = 0;

      // State machine variables local to the current buffer scan
      // Must be reset because we re-scan the buffer from the start
      let depth = 0;
      let inString = false;
      let escaped = false;
      let startIndex = -1;

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") {
            if (depth === 0) {
              startIndex = i;
            }
            depth++;
          } else if (char === "}") {
            depth--;
            if (depth === 0 && startIndex !== -1) {
              // End of an object
              const jsonStr = buffer.substring(startIndex, i + 1);
              try {
                const item = JSON.parse(jsonStr) as MacCMSVideo;
                yield { kind: "item", value: item };
              } catch (e) {
                console.warn(
                  "Stream JSON parse error",
                  e,
                  "JSON snippet:",
                  jsonStr,
                );
              }

              // Advance processedIndex to verify we are done with this segment
              processedIndex = i + 1;
              startIndex = -1;
            }
          } else if (char === "]" && depth === 0) {
            // End of "list" array
            return;
          }
        }
      }

      // Trim buffer to remove processed objects
      if (processedIndex > 0) {
        buffer = buffer.substring(processedIndex);
      }
    }
  }
}
