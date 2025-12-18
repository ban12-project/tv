"use client";

import * as React from "react";
import { getCategoryVideos } from "@/app/actions/content";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { VideoCard } from "@/components/video-card";
import type { Video } from "@/lib/adapters/types";

interface CategoryVideoListProps {
  initialVideos: Video[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  categoryId: string;
}

export function CategoryVideoList({
  initialVideos,
  initialTotal,
  initialPage,
  initialLimit,
  categoryId,
}: CategoryVideoListProps) {
  const [videos, setVideos] = React.useState<Video[]>(initialVideos);
  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const [isPending, startTransition] = React.useTransition();

  const totalPages = Math.ceil(initialTotal / initialLimit);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isPending) {
      return;
    }

    startTransition(async () => {
      try {
        // Update URL shallowly
        const url = new URL(window.location.href);
        url.searchParams.set("page", page.toString());
        window.history.pushState({}, "", url.toString());

        const data = await getCategoryVideos(categoryId, page);
        setVideos(data.videos);
        setCurrentPage(data.page);

        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
    });
  };

  const renderPaginationItems = () => {
    const items: React.ReactNode[] = [];

    // Always show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          href={`?page=1`}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            handlePageChange(1);
          }}
          isActive={currentPage === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>,
    );

    // Left Ellipsis
    if (currentPage > 3) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Middle pages
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href={`?page=${i}`}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              handlePageChange(i);
            }}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    // Right Ellipsis
    if (currentPage < totalPages - 2) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Always show last page if different from first
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            href={`?page=${totalPages}`}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              handlePageChange(totalPages);
            }}
            isActive={currentPage === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    return items;
  };

  return (
    <div className="space-y-8">
      <div
        className={
          isPending ? "opacity-50 transition-opacity" : "transition-opacity"
        }
      >
        {videos.length === 0 ? (
          <div className="text-center py-20 text-neutral-500">
            No videos found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-8 gap-x-4 md:gap-x-6">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} className="w-full" />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  handlePageChange(currentPage - 1);
                }}
                className={
                  currentPage <= 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {renderPaginationItems()}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  handlePageChange(currentPage + 1);
                }}
                className={
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
