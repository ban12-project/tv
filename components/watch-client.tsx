"use client";

import { EpisodeCard } from "@/components/episode-card";
import VideoPlayer from "@/components/video-player";
import type { Messages } from "@/get-dictionary";
import type { Episode, Video } from "@/lib/adapters/types";

interface WatchClientProps {
  video: Video;
  episodes: Episode[];
  dictionary: Messages;
  lang: string;
  episodeIndex: number;
}

export default function WatchClient({
  video,
  episodes,
  dictionary,
  lang: _lang,
  episodeIndex,
}: WatchClientProps) {
  // const router = useRouter(); // Might still need router? No, using Links.
  // const searchParams = useSearchParams();

  const currentEpisodeIndex = episodeIndex;
  const currentEpisode = episodes[currentEpisodeIndex];

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Main Player Area */}
        <div className="w-full bg-black relative">
          {currentEpisode ? (
            <div className="w-full flex items-center justify-center">
              <div className="w-full max-w-5xl aspect-video">
                <VideoPlayer
                  videoUrl={currentEpisode.url}
                  poster={video.backgroundImage || video.image}
                  title={`${video.title} - ${currentEpisode.name}`}
                  autoPlay={true}
                  dictionary={dictionary}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[50vh] text-gray-400">
              No playable source found.
            </div>
          )}
        </div>

        {/* Episode Selector */}
        {episodes.length > 1 && (
          <div className="w-full flex-1 flex flex-col mt-8">
            <div className="px-4 md:px-12 mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                Episodes
              </h2>
              <div className="text-sm font-medium text-gray-400">
                {video.title}
              </div>
            </div>

            <div className="w-full overflow-x-auto pb-12 px-4 md:px-12 scrollbar-hide">
              <div className="flex gap-4 min-w-min">
                {episodes.map((ep, index) => (
                  <EpisodeCard
                    key={`${ep.name}-${index}`}
                    episode={ep}
                    index={index}
                    isActive={currentEpisodeIndex === index}
                    video={video}
                    linkHref={`/watch/${video.id}/${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
