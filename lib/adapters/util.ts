import type { MacCMSVideo, Video } from "./types";

/**
 * Standardizes the generation of a unique key for video de-duplication.
 * Uses title (no whitespace), year, and video type.
 */
export function getVideoUniqueKey(
  video: Pick<Video, "title" | "year" | "type">,
): string {
  const cleanTitle = video.title.replace(/\s+/g, "");
  const year = video.year || "unknown";
  return `${cleanTitle}-${year}-${video.type}`;
}

export function getType(item: MacCMSVideo) {
  const isMovie =
    item.type_name === "电影" || parseEpisodes(item.vod_play_url).length <= 1;
  const type = isMovie ? "movie" : "tv";
  return type;
}

/**
 * Parses video play URLs into structured episodes.
 * Supports `$` delimited formats and `#` delimited lists.
 * @param playUrl The raw play URL string from API
 */
export function parseEpisodes(
  playUrl: string,
): { name: string; url: string }[] {
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
    return Array.from(new Set(episodes)).map((link: string, index: number) => {
      let cleanLink = link.substring(1); // Remove leading $
      const parenIndex = cleanLink.indexOf("(");
      if (parenIndex > 0) {
        cleanLink = cleanLink.substring(0, parenIndex);
      }

      return {
        name: `Episode ${index + 1}`,
        url: cleanLink.replace(/^http:\/\//i, "https://"),
      };
    });
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
