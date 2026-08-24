"use client";

import { useRef, useState } from "react";

export function RecordingPlayer({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const previewSrc = src.endsWith("/media") ? `${src.slice(0, -"/media".length)}/preview` : null;

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
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fff4df] px-4 py-3 text-sm text-[#614514]">
            <span>The direct stream was interrupted. The secure backup player is shown below.</span>
            <button type="button" onClick={retryPlayback} className="rounded-full bg-[#22304a] px-4 py-2 font-semibold text-white">
              Retry direct player
            </button>
          </div>
          {previewSrc ? (
            <iframe
              src={previewSrc}
              title={`${title} backup player`}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="aspect-video w-full rounded-[24px] border-0 bg-black shadow-sm"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}