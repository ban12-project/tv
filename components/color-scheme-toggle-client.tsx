"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export default dynamic(() => import("./color-scheme-toggle"), {
  ssr: false,
  loading: () => <Skeleton className="w-18.5 h-6.5 rounded-full"></Skeleton>,
});
