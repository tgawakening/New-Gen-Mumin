"use client";

export function RecordingPlayer({ src, title }: { src: string; title: string }) {
  return (
    <video
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onContextMenu={(event) => event.preventDefault()}
      preload="metadata"
      className="aspect-video w-full rounded-[24px] bg-black shadow-sm"
      aria-label={title}
    >
      <source src={src} type="video/mp4" />
      Your browser cannot play this recording.
    </video>
  );
}
