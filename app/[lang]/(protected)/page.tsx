import { HomeSearch } from "@/components/home-search";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";

export default async function Home(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const dict = await getDictionary(lang);

  return (
    <main className="min-h-[calc(100dvh-65px)]">
      <HomeSearch dictionary={dict} />
    </main>
  );
}
