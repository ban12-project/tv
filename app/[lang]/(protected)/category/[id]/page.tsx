import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { getCategory, getCategoryVideos } from "@/app/actions/content";
import { CategoryVideoList } from "@/components/category-video-list";
import { sourceProvider } from "@/lib/source-provider";

interface CategoryPageProps {
  params: Promise<{
    id: string;
    lang: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateStaticParams() {
  const categories = await sourceProvider.getCategories();

  return categories
    .filter((category) => category.parentId !== 0)
    .map((category) => ({
      id: String(category.id),
    }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { id } = await params;
  const category = await getCategory(id);

  if (!category) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 md:px-8 bg-black">
      <div className="max-w-450 mx-auto space-y-8">
        <div className="space-y-2">
          <ViewTransition name="category-title">
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              {category.name}
            </h1>
          </ViewTransition>
          <p className="text-neutral-400">
            Explore our collection of {category.name}
          </p>
        </div>

        <Suspense fallback={<VideosLoading />}>
          <CategoryVideos id={id} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function CategoryVideos({
  id,
  searchParams,
}: {
  id: string;
} & Pick<CategoryPageProps, "searchParams">) {
  const { page } = await searchParams;

  // Parse page number, default to 1
  const currentPage = Number(page) || 1;

  // Initial fetch for SSR
  const { videos, total, limit } = await getCategoryVideos(id, currentPage);

  return (
    <CategoryVideoList
      initialVideos={videos}
      initialTotal={total}
      initialPage={currentPage}
      initialLimit={limit}
      categoryId={id}
    />
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
