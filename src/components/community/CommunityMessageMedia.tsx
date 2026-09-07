export function CommunityMessageMedia({ message }: { message: { id: string; body: string; audioDriveFileId: string | null; audioMimeType: string | null } }) {
  if (!message.audioDriveFileId) return null;
  const src = `/api/community/voice/${message.id}`;
  const mime = message.audioMimeType || "";
  if (mime.startsWith("image/")) return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={message.body} className="mt-3 max-h-80 w-auto max-w-full rounded-2xl border border-white/20 object-contain" /></a>;
  if (mime.startsWith("video/")) return <video controls preload="metadata" src={src} className="mt-3 max-h-80 w-full rounded-2xl bg-black" />;
  if (mime.startsWith("audio/")) return <audio controls preload="metadata" src={src} className="mt-3 h-10 w-full" />;
  return <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#17345c]">Open shared file: {message.body}</a>;
}
