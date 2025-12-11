import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { getCategory, getCategoryVideos } from "@/app/actions/content";
import { VideoCard } from "@/components/video-card";
import { i18n } from "@/i18n-config";
import { sourceProvider } from "@/lib/source-provider";

interface CategoryPageProps {
  params: Promise<{
    id: string;
    lang: string;
  }>;
}

export async function generateStaticParams() {
  const categories = await sourceProvider.getCategories();

  return i18n.locales.map((locale) =>
    categories
      .filter((category) => category.type_pid !== 0)
      .map((category) => ({
        id: category.type_id,
        lang: locale,
      })),
  );
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;
  const category = await getCategory(id);

  if (!category) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 md:px-8 bg-black">
      <div className="max-w-[1800px] mx-auto space-y-8">
        <div className="space-y-2">
          <ViewTransition name="category-title">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              {category.type_name}
            </h1>
          </ViewTransition>
          <p className="text-neutral-400">
            Explore our collection of {category.type_name}
          </p>
        </div>

        <Suspense fallback={<VideosLoading />}>
          <CategoryVideos id={id} />
        </Suspense>
      </div>
    </main>
  );
}

async function CategoryVideos({ id }: { id: string }) {
  const { videos } = await getCategoryVideos(id);

  if (videos.length === 0) {
    return (
      <div className="text-center py-20 text-neutral-500">
        No videos found in this category.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-4 md:gap-x-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} className="w-full" />
      ))}
    </div>
  );
}

function VideosLoading() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-4 md:gap-x-6 animate-pulse">
      {[...Array(10)].map((_, i) => (
        <div key={String(i)} className="space-y-3">
          <div className="aspect-video rounded-xl bg-neutral-800" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-neutral-800 rounded" />
            <div className="h-3 w-1/2 bg-neutral-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
