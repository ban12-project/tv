"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";
import { type Content, searchContent } from "@/lib/content";

export default function Header({ dictionary: dict }: { dictionary: Messages }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchContent(searchQuery);
      setSearchResults(results);
      setIsSearchOpen(true);
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <Image
                src="https://ext.same-assets.com/3817037992/4197243448.svg"
                alt={dict.header["alt-apple-tv"]}
                width={24}
                height={24}
                className="h-6 w-auto"
              />
              <span className="text-white text-sm font-medium">
                {dict.header["brand-name-open-tv"]}
              </span>
              <Image
                src="https://ext.same-assets.com/3817037992/3446096220.svg"
                alt={dict.header["alt-external-link"]}
                width={12}
                height={12}
                className="h-3 w-3"
              />
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a
                href="/"
                className="text-white hover:text-gray-300 transition-colors font-medium"
              >
                {dict.header["nav-apple-tv-plus"]}
              </a>
              <a
                href="/"
                className="text-white hover:text-gray-300 transition-colors font-medium"
              >
                {dict.header["nav-mls"]}
              </a>
            </nav>
          </div>

          {/* Search and Sign In */}
          <div className="flex items-center space-x-4">
            <div className="relative" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={dict.header["search-placeholder"]}
                className="bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 lg:w-80"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-white" />
                </Button>
              )}

              {/* Search Results Dropdown */}
              {isSearchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
                  <div className="p-2">
                    <div className="text-gray-400 text-xs uppercase tracking-wide mb-2 px-2">
                      {dict.header["search-results-count"].replace(
                        "{count}",
                        searchResults.length.toString(),
                      )}
                      {searchResults.length !== 1
                        ? dict.header["search-results-count-plural-suffix"]
                        : ""}
                    </div>
                    {searchResults.slice(0, 8).map((content) => (
                      <Link
                        key={content.id}
                        href={`/content/${content.id}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center p-3 rounded-lg hover:bg-gray-800 transition-colors group"
                      >
                        <Image
                          src={content.image}
                          alt={content.title}
                          width={48}
                          height={32}
                          className="w-12 h-8 object-cover rounded mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors truncate">
                            {content.title}
                          </h3>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <span className="capitalize">{content.type}</span>
                            <span>•</span>
                            <span>{content.year}</span>
                            <span>•</span>
                            <span>{content.genre[0]}</span>
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          {content.emmyNominations && (
                            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs mr-2">
                              {dict.header["search-result-emmy"]}
                            </span>
                          )}
                          {content.newRelease && (
                            <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs">
                              {dict.header["search-result-new"]}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                    {searchResults.length > 8 && (
                      <div className="p-3 text-center">
                        <Link
                          href={`/search?q=${encodeURIComponent(searchQuery)}`}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                          onClick={() => setIsSearchOpen(false)}
                        >
                          {dict.header["search-view-all-results"].replace(
                            "{count}",
                            searchResults.length.toString(),
                          )}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Results */}
              {isSearchOpen && searchQuery && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50">
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">
                      {dict.header["search-no-results-found"].replace(
                        "{query}",
                        searchQuery,
                      )}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {dict.header["search-try-searching"]}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <title>{dict.header["title-sign-in"]}</title>
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{dict.header["button-sign-in"]}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
