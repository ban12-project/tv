import { redirect } from "next/navigation";
import { getApiSources } from "@/app/actions/cms";
import { MacCMSAdapter } from "./adapters/mac-cms-adapter";
import type {
  MacCMSListParams,
  SearchResult,
  Video,
  VideoSourceAdapter,
} from "./adapters/types";
import { getVideoUniqueKey } from "./adapters/util";

export class MultiSourceProvider implements VideoSourceAdapter {
  async getAdapters(): Promise<
    { id: string; name: string; adapter: MacCMSAdapter }[]
  > {
    const sources = await getApiSources();
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      adapter: new MacCMSAdapter(source.url, source.id, source.name),
    }));
  }

  // Ensure adapters exist, otherwise redirect to source config
  // Used by page-critical methods
  private async ensureAdapters() {
    const adapters = await this.getAdapters();
    if (adapters.length === 0) {
      redirect("/verify-cms");
    }
    return adapters;
  }

  async getAdapter(sourceId: string): Promise<MacCMSAdapter | null> {
    const sources = await getApiSources();
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return null;
    return new MacCMSAdapter(source.url, source.id, source.name);
  }

  // Aggregate and dedup videos
  private aggregateVideos(allVideos: Video[]): Video[] {
    const videoMap = new Map<string, Video>();

    for (const video of allVideos) {
      const key = getVideoUniqueKey(video);
      if (!videoMap.has(key)) {
        // Tag with composite key for debugging/client usage if needed
        video.uniqueKey = key;
        videoMap.set(key, video);
      } else {
        // Merge strategy? For now, we prefer the first one found
      }
    }
    return Array.from(videoMap.values());
  }

  async getDetails(id: string, sourceId?: string): Promise<Video | null> {
    const adapters = await this.ensureAdapters();

    if (sourceId) {
      const source = adapters.find((s) => s.id === sourceId);
      if (source) {
        try {
          const video = await source.adapter.getDetails(id);
          if (video) {
            return { ...video, sourceId: source.id, sourceName: source.name };
          }
        } catch (e) {
          console.error(`Failed to get details from source ${sourceId}`, e);
        }
        return null;
      }
    }

    for (const { id: sId, name, adapter } of adapters) {
      try {
        const video = await adapter.getDetails(id);
        if (video) {
          return { ...video, sourceId: sId, sourceName: name };
        }
      } catch (_) {
        // ignore
      }
    }
    return null;
  }

  async getVideos(params: MacCMSListParams): Promise<SearchResult> {
    const adapters = await this.ensureAdapters();

    const results = await Promise.all(
      adapters.map(async ({ id, name, adapter }) => {
        try {
          const res = await adapter.getVideos(params);
          return {
            ...res,
            videos: res.videos.map((v) => ({
              ...v,
              sourceId: id,
              sourceName: name,
            })),
          };
        } catch (_) {
          return null;
        }
      }),
    );

    const validResults = results.filter((r) => r !== null);
    const allVideos = validResults.flatMap((r) => r!.videos);
    const total = validResults.reduce((acc, r) => acc + r!.total, 0);

    return {
      videos: this.aggregateVideos(allVideos),
      total,
      page: Number(params.pg || 1),
      limit: Number(params.limit || params.pagesize || 20),
    };
  }

  /**
   * Merges multiple AsyncGenerators into one, yielding values as they arrive.
   */
  private async *mergeGenerators<T>(
    generators: AsyncGenerator<T>[],
  ): AsyncGenerator<T> {
    const nextPromises = generators.map(async (g, index) => {
      try {
        const result = await g.next();
        return { result, index };
      } catch {
        return { result: { done: true as const, value: undefined }, index };
      }
    });

    const activeIndices = new Set(generators.keys());

    while (activeIndices.size > 0) {
      const { result, index } = await Promise.race(
        Array.from(activeIndices).map((i) => nextPromises[i]),
      );

      if (result.done) {
        activeIndices.delete(index);
      } else {
        yield result.value;
        // Schedule next pull from this generator
        nextPromises[index] = generators[index]
          .next()
          .then((res) => ({
            result: res,
            index,
          }))
          .catch(() => ({
            result: { done: true as const, value: undefined },
            index,
          }));
      }
    }
  }

  /**
   * Helper to stream results from adapters as they complete.
   * Keeps compatibility with Promise-based adapter calls.
   */
  private async *streamAdapters<T>(
    adapterPromises: Promise<{ id: string; name: string; result: T | null }>[],
  ): AsyncGenerator<{ id: string; name: string; result: T }> {
    const promises = adapterPromises.map((p, index) =>
      p.then((res) => ({ res, index })),
    );
    const pool = new Map(promises.map((p, i) => [i, p]));

    while (pool.size > 0) {
      const { res, index } = await Promise.race(pool.values());
      pool.delete(index);

      if (res && res.result !== null) {
        yield { id: res.id, name: res.name, result: res.result };
      }
    }
  }

  async *searchStream(
    query: string,
    page?: number,
  ): AsyncGenerator<SearchResult> {
    const adapters = await this.ensureAdapters();

    const generators = adapters.map(({ id, name, adapter }) => {
      const g = (async function* () {
        try {
          for await (const result of adapter.searchStream(query, page)) {
            yield {
              ...result,
              videos: result.videos.map((v) => ({
                ...v,
                sourceId: id,
                sourceName: name,
              })),
            };
          }
        } catch (e) {
          console.error(`Failed to stream search from source ${id}`, e);
        }
      })();
      return g;
    });

    yield* this.mergeGenerators(generators);
  }

  async *getVideosStream(
    params: MacCMSListParams,
  ): AsyncGenerator<SearchResult> {
    const adapters = await this.ensureAdapters();

    const generators = adapters.map(({ id, name, adapter }) => {
      const g = (async function* () {
        try {
          for await (const result of adapter.getVideosStream(params)) {
            yield {
              ...result,
              videos: result.videos.map((v) => ({
                ...v,
                sourceId: id,
                sourceName: name,
              })),
            };
          }
        } catch (e) {
          console.error(`Failed to stream videos from source ${id}`, e);
        }
      })();
      return g;
    });

    yield* this.mergeGenerators(generators);
  }

  async *findMatchesStream(
    video: Video,
  ): AsyncGenerator<{ sourceId: string; sourceName: string; video: Video }[]> {
    const adapters = await this.ensureAdapters();
    const simpleKey = getVideoUniqueKey(video);

    const promises = adapters.map(async ({ id, name, adapter }) => {
      try {
        const res = await adapter.search(video.title);
        const matches = res.videos
          .filter((v) => getVideoUniqueKey(v) === simpleKey)
          .map((v) => ({
            sourceId: id,
            sourceName: name,
            video: v,
          }));
        return { id, name, result: matches };
      } catch (_) {
        return { id, name, result: null };
      }
    });

    for await (const { result } of this.streamAdapters(promises)) {
      if (result && result.length > 0) {
        yield result;
      }
    }
  }
}

export const sourceProvider = new MultiSourceProvider();
