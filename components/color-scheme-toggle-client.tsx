"use client";

import dynamic from "next/dynamic";

export default dynamic(() => import("./color-scheme-toggle"), {
  ssr: false,
  loading: () => <div className="w-18.5 h-6.5"></div>,
});
