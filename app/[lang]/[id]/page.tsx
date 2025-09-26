import { Download, Play, Plus, Share } from "lucide-react";
import { notFound } from "next/navigation";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/video-player";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { getContentById } from "@/lib/content";

type Props = Readonly<{
  params: Promise<{ lang: Locale; id: string }>;
}>;

export default async function ContentPage({ params }: Props) {
  const { lang, id } = await params;
  const dictionary = await getDictionary(lang);
  const content = getContentById(id);

  if (!content) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      <Header dictionary={dictionary} />

      {/* Hero Section */}
      <section className="relative h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${content.backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </div>

        <div className="relative z-10 flex items-center h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            {/* Badges */}
            <div className="flex items-center space-x-3 mb-4">
              {content.emmyNominations && (
                <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  Emmy® Nominee
                </span>
              )}
              {content.newRelease && (
                <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  New Release
                </span>
              )}
              {content.trending && (
                <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Trending
                </span>
              )}
            </div>

            {/* Content Info */}
            <div className="flex items-center space-x-4 text-gray-300 text-sm mb-4">
              <span className="bg-gray-600 px-2 py-1 rounded text-xs">
                {content.rating}
              </span>
              <span>{content.year}</span>
              {content.duration && <span>{content.duration}</span>}
              {content.seasons && (
                <span>
                  {content.seasons} Season{content.seasons > 1 ? "s" : ""}
                </span>
              )}
              <span>{content.genre.join(", ")}</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {content.title}
            </h1>

            <p className="text-xl text-gray-200 mb-8 leading-relaxed">
              {content.longDescription}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center space-x-4">
              <Button size="lg">
                <Play className="w-5 h-5" fill="currentColor" />
                <span>Play</span>
              </Button>

              <Button variant="secondary" size="lg">
                <Plus className="w-5 h-5" />
                <span>Watchlist</span>
              </Button>

              <Button variant="secondary" size="icon">
                <Download className="w-5 h-5" />
              </Button>

              <Button variant="secondary" size="icon">
                <Share className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Details */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Trailer */}
              {content.trailerUrl && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Trailer
                  </h2>
                  <VideoPlayer
                    videoUrl={content.trailerUrl}
                    dictionary={dictionary}
                  />
                </div>
              )}

              {/* Episodes/Seasons (for shows) */}
              {content.type === "show" && content.seasons && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Episodes
                  </h2>
                  <div className="bg-gray-900/50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <select className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2">
                        {Array.from({ length: content.seasons }, (_, i) => (
                          <option key={`season-${i + 1}`} value={i + 1}>
                            Season {i + 1}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray-400 text-sm">
                        {content.episodes || 10} episodes
                      </span>
                    </div>

                    {/* Episode List */}
                    <div className="space-y-4">
                      {Array.from(
                        { length: Math.min(content.episodes || 10, 10) },
                        (_, i) => (
                          <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: mock data
                            key={i + 1}
                            className="flex items-center p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer group"
                          >
                            <div className="w-16 h-10 bg-gray-700 rounded mr-4 flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                              <Play
                                className="w-4 h-4 text-white"
                                fill="currentColor"
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-medium mb-1">
                                Episode {i + 1}: {getEpisodeTitle(i + 1)}
                              </h4>
                              <p className="text-gray-400 text-sm">
                                {getEpisodeDuration()} •{" "}
                                {getEpisodeDescription(i + 1)}
                              </p>
                            </div>
                            <span className="text-gray-500 text-sm">
                              {getEpisodeDuration()}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cast & Crew */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Cast & Crew
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {content.cast.map((member) => (
                    <div
                      key={member.name}
                      className="flex items-center p-4 bg-gray-900/30 rounded-lg"
                    >
                      <div className="w-12 h-12 bg-gray-700 rounded-full mr-4 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {member.name}
                        </h4>
                        <p className="text-gray-400 text-sm">{member.role}</p>
                      </div>
                    </div>
                  ))}

                  {content.director && (
                    <div className="flex items-center p-4 bg-gray-900/30 rounded-lg">
                      <div className="w-12 h-12 bg-gray-700 rounded-full mr-4 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {content.director
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {content.director}
                        </h4>
                        <p className="text-gray-400 text-sm">Director</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 rounded-lg p-6 sticky top-24">
                <h3 className="text-xl font-bold text-white mb-6">About</h3>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-gray-400">Release Date:</span>
                    <span className="text-white ml-2">
                      {new Date(content.releaseDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400">Genre:</span>
                    <span className="text-white ml-2">
                      {content.genre.join(", ")}
                    </span>
                  </div>

                  {content.director && (
                    <div>
                      <span className="text-gray-400">Director:</span>
                      <span className="text-white ml-2">
                        {content.director}
                      </span>
                    </div>
                  )}

                  {content.producer && (
                    <div>
                      <span className="text-gray-400">Producer:</span>
                      <span className="text-white ml-2">
                        {content.producer}
                      </span>
                    </div>
                  )}

                  {content.emmyNominations && (
                    <div>
                      <span className="text-gray-400">Emmy Nominations:</span>
                      <span className="text-white ml-2">
                        {content.emmyNominations}
                      </span>
                    </div>
                  )}

                  {content.awards && content.awards.length > 0 && (
                    <div>
                      <span className="text-gray-400">Awards:</span>
                      <div className="mt-1">
                        {content.awards.map((award) => (
                          <span
                            key={award}
                            className="inline-block bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs mr-2 mb-1"
                          >
                            {award}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Helper functions for episode data
function getEpisodeTitle(episodeNumber: number): string {
  const titles = [
    "Pilot",
    "The Awakening",
    "Revelations",
    "The Journey",
    "Confrontation",
    "New Horizons",
    "The Truth",
    "Redemption",
    "The Final Hour",
    "Resolution",
  ];
  return titles[episodeNumber - 1] || `Episode ${episodeNumber}`;
}

function getEpisodeDuration(): string {
  return `${Math.floor(Math.random() * 20 + 40)} min`;
}

function getEpisodeDescription(episodeNumber: number): string {
  const descriptions = [
    "The beginning of an extraordinary journey.",
    "Secrets are revealed that change everything.",
    "A shocking discovery turns the world upside down.",
    "The team faces their greatest challenge yet.",
    "Tensions rise as the truth comes to light.",
    "New alliances are formed in unexpected places.",
    "The past catches up with our heroes.",
    "A final desperate attempt to save the day.",
    "Everything comes to a head in this climactic episode.",
    "The conclusion that will change everything.",
  ];
  return (
    descriptions[episodeNumber - 1] ||
    "An exciting episode you won't want to miss."
  );
}
