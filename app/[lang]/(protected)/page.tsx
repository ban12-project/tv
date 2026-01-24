import { HomeSearch } from "@/components/home-search";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { getInitialSearchResults } from "@/lib/actions/content";
import type { Video } from "@/lib/adapters/types";

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
      initialResults.push(...(await getInitialSearchResults(q)));
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
