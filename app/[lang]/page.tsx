import ContentCarousel from "@/components/content-carousel";
import DeviceSection from "@/components/device-section";
import EmmySection from "@/components/emmy-section";
import FaqSection from "@/components/faq-section";
import Footer from "@/components/footer";
import Header from "@/components/header";
import HeroSection from "@/components/hero-section";
import TopTenSection from "@/components/top-ten-section";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";

// Sample content data
const freePremieres = [
  {
    id: "chief-of-war-free",
    title: "Chief of War",
    image: "https://ext.same-assets.com/3817037992/855966671.webp",
    description:
      "A ferocious Hawaiian warrior embarks on an epic mission to unite his people.",
  },
  {
    id: "stick-free",
    title: "Stick",
    image: "https://ext.same-assets.com/3817037992/2755306390.webp",
    description:
      "Owen Wilson is an ex-pro golfer taking a big swing at his second chance.",
  },
  {
    id: "foundation-free",
    title: "Foundation",
    image: "https://ext.same-assets.com/3817037992/877906450.webp",
    description:
      "The fate of humanity hangs by a thread as a deadly new enemy unleashes his wrath.",
  },
];

const newReleases = [
  {
    id: "stillwater",
    title: "Stillwater",
    image: "https://ext.same-assets.com/3817037992/1938554386.webp",
    badge: "KIDS & FAMILY",
    description:
      "A wise panda teaches three young siblings about the world and each other.",
  },
  {
    id: "careme",
    title: "Carême",
    image: "https://ext.same-assets.com/3817037992/611518650.webp",
    badge: "DRAMA",
    description:
      "A brilliant, seductive chef turns to espionage in Napoleon-era France.",
  },
  {
    id: "smoke",
    title: "Smoke",
    image: "https://ext.same-assets.com/3817037992/3068608778.webp",
    badge: "THRILLER",
    description:
      "To stop two serial arsonists, an arson investigator and a police detective join forces.",
  },
  {
    id: "lulu",
    title: "Lulu is a Rhinoceros",
    image: "https://ext.same-assets.com/3817037992/1080209201.webp",
    badge: "KIDS & FAMILY",
    description:
      "Embark on a joyful musical journey as Lulu spreads kindness and courage.",
  },
];

const comingSoon = [
  {
    id: "platonic",
    title: "Platonic",
    image: "https://ext.same-assets.com/3817037992/418501586.webp",
    badge: "New Season Wednesday",
  },
  {
    id: "summer-musical",
    title: "A Summer Musical",
    image: "https://ext.same-assets.com/3817037992/114687527.webp",
    badge: "New Special Aug 15",
  },
  {
    id: "invasion",
    title: "Invasion",
    image: "https://ext.same-assets.com/3817037992/739433336.webp",
    badge: "New Season Aug 22",
  },
  {
    id: "shape-island",
    title: "Shape Island",
    image: "https://ext.same-assets.com/3817037992/1793402781.webp",
    badge: "New Season Aug 29",
  },
];

const mustSeeHits = [
  {
    id: "morning-show",
    title: "The Morning Show",
    image: "https://ext.same-assets.com/3817037992/4033354227.webp",
  },
  {
    id: "silo",
    title: "Silo",
    image: "https://ext.same-assets.com/3817037992/3515641319.webp",
  },
  {
    id: "see",
    title: "See",
    image: "https://ext.same-assets.com/3817037992/1655615194.webp",
  },
  {
    id: "presumed-innocent",
    title: "Presumed Innocent",
    image: "https://ext.same-assets.com/3817037992/1496554218.webp",
  },
];

type Props = Readonly<{
  params: Promise<{
    lang: Locale;
  }>;
}>;

export default async function Home({ params }: Props) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return (
    <div className="min-h-screen bg-black">
      <Header dictionary={dictionary} />
      <main>
        <HeroSection dictionary={dictionary} />
        <EmmySection />
        <TopTenSection type="shows" />
        <TopTenSection type="movies" />
        <ContentCarousel
          title="Watch Premieres for Free"
          items={freePremieres}
        />
        <ContentCarousel title="New Releases" items={newReleases} />
        <ContentCarousel title="Coming to Apple TV+" items={comingSoon} />
        <ContentCarousel title="Must-See Hits" items={mustSeeHits} />
        <DeviceSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
