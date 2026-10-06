export type RemotePlaybackVideo = HTMLVideoElement & {
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

export function isRemotePlaybackActive(video: RemotePlaybackVideo) {
  return (
    video.webkitCurrentPlaybackTargetIsWireless === true ||
    video.remote?.state === "connecting" ||
    video.remote?.state === "connected"
  );
}
