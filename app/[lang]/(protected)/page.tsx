import { HomeSearch } from "@/components/home-search";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { searchVideosStream } from "@/lib/actions/content";
import type { Video } from "@/lib/adapters/types";
import { getVideoUniqueKey } from "@/lib/adapters/util";

export default async function Home(props: {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await props.params;
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const dict = await getDictionary(lang);

  const initialResults: Video[] = [];

  if (q) {
    try {
      const stream = await searchVideosStream(q);
      const uniqueKeys = new Set<string>();

      for await (const chunk of stream) {
        if (chunk.videos) {
          for (const video of chunk.videos) {
            const key = getVideoUniqueKey(video);
            if (!uniqueKeys.has(key)) {
              uniqueKeys.add(key);
              initialResults.push(video);
            }
          }
          // Fetch enough for the first view
          if (initialResults.length >= 20) break;
        }
      }
    } catch (error) {
      console.error("SSR search failed:", error);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-65px)]">
      <HomeSearch
        key={q || "empty"}
        dictionary={dict}
        initialResults={initialResults}
      />
    </main>
  );
}
