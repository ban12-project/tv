import type { SearchResult, Video, VideoSourceAdapter } from "./types";

interface MacCMSResponse {
  code: number;
  msg: string;
  page: number | string;
  pagecount: number | string;
  limit: number | string;
  total: number | string;
  list: MacCMSVideo[];
}

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
}

export class MacCMSAdapter implements VideoSourceAdapter {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetchAPI(
    params: Record<string, string>,
  ): Promise<MacCMSResponse> {
    const searchParams = new URLSearchParams(params);
    const url = `${this.baseUrl}?${searchParams.toString()}`;

    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
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

  private mapToVideo = (item: MacCMSVideo): Video => {
    return {
      id: item.vod_id.toString(),
      title: item.vod_name,
      type: "show", // MacCMS often mixes them; simplified for now or strictly based on type_name
      genre: [item.type_name],
      year: item.vod_year,
      description: item.vod_content.replace(/<[^>]*>/g, "").trim(), // Remove HTML tags
      image: item.vod_pic,
      backgroundImage: item.vod_pic, // Fallback
      director: item.vod_director,
      cast: item.vod_actor.split(","),
      vod_play_url: item.vod_play_url,
      vod_play_from: item.vod_play_from,
      episodes: this.parseEpisodes(item.vod_play_url),
    };
  };

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
            url: cleanLink,
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
            return { name: parts[0], url: parts[1] };
          }
          return {
            name: `Episode ${playUrl.split("#").indexOf(segment) + 1}`,
            url: segment,
          };
        })
        .filter(
          (ep) =>
            ep.url && (ep.url.startsWith("http") || ep.url.startsWith("//")),
        );
    }

    return [];
  }

  async getHomeModules(): Promise<{
    trending: Video[];
    newReleases: Video[];
    featured: Video[];
  }> {
    // MacCMS doesn't strictly have "modules", so we fetch recent items.
    const response = await this.fetchAPI({ ac: "detail", h: "24" }); // Recent 24 items
    const videos = response.list.map(this.mapToVideo);

    return {
      trending: videos.slice(0, 10),
      newReleases: videos.slice(10, 20),
      featured: videos.slice(0, 5),
    };
  }

  async getDetails(id: string): Promise<Video | null> {
    const response = await this.fetchAPI({ ac: "detail", ids: id });
    if (response.list && response.list.length > 0) {
      return this.mapToVideo(response.list[0]);
    }
    return null;
  }

  async search(query: string, page = 1): Promise<SearchResult> {
    const response = await this.fetchAPI({
      ac: "detail",
      wd: query,
      pg: page.toString(),
    });

    return {
      videos: response.list.map(this.mapToVideo),
      total: Number(response.total),
      page: Number(response.page),
      limit: Number(response.limit),
    };
  }
}
