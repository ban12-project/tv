"use client";

import Link from "@/components/link";
import { Separator } from "@/components/ui/separator";

const languages = [
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "th", name: "ไทย" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "fil", name: "Filipino" },
];

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-2">
        {/* Language Links */}
        <div className="flex flex-wrap gap-4 text-xs mb-4">
          {languages.map((lang) => (
            <a
              key={lang.code}
              href={`/${lang.code}`}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {lang.name}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-gray-300 text-xs">
          Copyright © 2025 Ban12. All rights reserved.
        </p>

        <div className="text-gray-500 text-xs flex h-5 py-1 items-center space-x-2">
          <Link href="/terms">Service Terms</Link>
          <Separator orientation="vertical" />
          <Link href="/privacy">Privacy</Link>
          <Separator orientation="vertical" />
          <Link href="/cookie">Cookie Policy</Link>
        </div>
      </div>
    </footer>
  );
}
