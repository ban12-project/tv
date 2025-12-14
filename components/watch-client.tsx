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
  const currentEpisodeIndex = episodeIndex;
  const currentEpisode = episodes[currentEpisodeIndex];

  return (
    <>
      {/* Main Player Area */}
      {currentEpisode ? (
        <VideoPlayer
          className="w-full max-w-7xl mx-auto lg:px-8 aspect-video"
          videoUrl={currentEpisode.url}
          poster={video.backgroundImage || video.image}
          title={`${video.title} - ${currentEpisode.name}`}
          autoPlay={true}
          dictionary={dictionary}
        />
      ) : (
        <div className="flex items-center justify-center h-[50vh] text-gray-400">
          No playable source found.
        </div>
      )}

      {/* Episode Selector */}
      {episodes.length > 1 && (
        <ul className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <li className="flex flex-wrap gap-2">
            {episodes.map((ep, index) => (
              <EpisodeCard
                key={`${ep.name}-${index}`}
                index={index}
                isActive={currentEpisodeIndex === index}
                linkHref={`/watch/${video.id}/${index + 1}`}
              />
            ))}
          </li>
        </ul>
      )}
    </>
  );
}
