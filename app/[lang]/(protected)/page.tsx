import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeSearch } from "@/components/home-search";
import { getDictionary, type Messages } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { getInitialSearchResults } from "@/lib/actions/content";
import type { Video } from "@/lib/adapters/types";
import { hasCmsAdmin } from "@/lib/features";
import { absoluteUrl, JsonLdScript } from "@/lib/seo";
import { MissingApiSourcesError } from "@/lib/source-provider";

export default async function Home(props: {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await props.params;
  const dict = await getDictionary(lang);

  return (
    <main className="min-h-[calc(100dvh-65px)]">
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": absoluteUrl(`/${lang}#webpage`),
          url: absoluteUrl(`/${lang}`),
          name: dict["brand-name"],
          description: dict["root-description"],
          inLanguage: lang,
          isPartOf: { "@id": absoluteUrl("/#website") },
        }}
      />
      <Suspense fallback={<HomeSearchLoading dictionary={dict} />}>
        <HomeSearchWithInitialResults
          dictionary={dict}
          lang={lang}
          searchParams={props.searchParams}
        />
      </Suspense>
    </main>
  );
}

async function HomeSearchWithInitialResults({
  dictionary,
  lang,
  searchParams,
}: {
  dictionary: Messages;
  lang: Locale;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const q =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q
      : undefined;
  const initialResults: Video[] = [];

  if (q) {
    try {
      initialResults.push(...(await getInitialSearchResults(q)));
    } catch (error) {
      if (error instanceof MissingApiSourcesError) {
        if (hasCmsAdmin()) {
          redirect(`/${lang}/verify-cms`);
        }
        console.error("No CMS sources configured.");
      }
      console.error("SSR search failed:", error);
    }
  }

  return (
    <HomeSearch
      key={q || "empty"}
      dictionary={dictionary}
      initialQuery={q}
      initialResults={initialResults}
    />
  );
}

function HomeSearchLoading({ dictionary }: { dictionary: Messages }) {
  const [brandLead, ...brandRest] = dictionary["brand-name"].split(" ");
  const brandTail = brandRest.join(" ");

  return (
    <div className="flex flex-col px-2 md:px-4 lg:px-6 max-w-7xl mx-auto w-full relative z-10">
      <div className="transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col items-center justify-center h-[70vh]">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground">
              {brandLead}
              {brandTail && (
                <>
                  {" "}
                  <span className="text-primary italic">{brandTail}</span>
                </>
              )}
            </h1>
            <p className="text-neutral-400 text-lg md:text-xl max-w-md mx-auto">
              {dictionary.header["search-try-searching"]}
            </p>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl transition-all duration-500 rounded-full opacity-50" />
            <div className="relative flex items-center">
              <input
                name="query"
                type="text"
                readOnly
                placeholder={dictionary.header["search-placeholder"]}
                className="w-full h-16 md:h-20 bg-secondary/40 backdrop-blur-xl border-2 border-border rounded-2xl px-6 text-xl md:text-2xl text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-300 shadow-2xl animate-caret-cycle"
                autoComplete="off"
                aria-label={dictionary.common.loading}
              />
              <div className="absolute right-6">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
