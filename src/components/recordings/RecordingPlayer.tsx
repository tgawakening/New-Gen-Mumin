"use client";

import { useRef, useState } from "react";

export function RecordingPlayer({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState(false);

  function retryPlayback() {
    setPlaybackError(false);
    const video = videoRef.current;
    if (!video) return;
    video.load();
    void video.play().catch(() => undefined);
  }

  return (
    <div>
      <video
        ref={videoRef}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(event) => event.preventDefault()}
        onCanPlay={() => setPlaybackError(false)}
        onError={() => setPlaybackError(true)}
        preload="metadata"
        className="aspect-video w-full rounded-[24px] bg-black shadow-sm"
        aria-label={title}
      >
        <source src={src} type="video/mp4" />
        Your browser cannot play this recording.
      </video>
      {playbackError ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fff4df] px-4 py-3 text-sm text-[#614514]">
          <span>Playback was interrupted temporarily. Your portal is still working.</span>
          <button type="button" onClick={retryPlayback} className="rounded-full bg-[#22304a] px-4 py-2 font-semibold text-white">
            Retry recording
          </button>
        </div>
      ) : null}
    </div>
  );
}