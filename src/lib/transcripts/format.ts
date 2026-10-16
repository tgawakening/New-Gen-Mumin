export type TranscriptSegment = { start: number; end: number; speaker: string; text: string };
export function timestamp(milliseconds: number) {
 const total = Math.max(0, Math.floor(milliseconds / 1000));
 return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function time(value: string) { const parts = value.replace(',', '.').split(':').map(Number); return parts.reduce((sum, part) => sum * 60 + part, 0) * 1000; }
function plain(value: string) { return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim(); }
export function parseVtt(input: string): TranscriptSegment[] {
 const result: TranscriptSegment[] = [];
 for (const block of input.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/)) {
  const lines = block.split('\n');
  if (/^(NOTE|STYLE|REGION)(\s|$)/.test(lines[0])) continue;
  const at = lines.findIndex(line => /\d\d:\d\d.*-->/.test(line));
  if (at < 0) continue;
  const match = lines[at].match(/((?:\d+:)?\d{2}:\d{2}[.,]\d+)\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d+)/);
  if (!match) continue;
  const start = time(match[1]), end = time(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
  const raw = lines.slice(at + 1).join('\n').trim();
  const voices = [...raw.matchAll(/<v(?:\.[^ >]+)?\s+([^>]+)>([\s\S]*?)(?:<\/v>|(?=<v)|$)/g)];
  if (voices.length) { for (const voice of voices) { const text = plain(voice[2]); if (text) result.push({ start, end, speaker: plain(voice[1]).slice(0, 120) || 'Unlabelled speaker', text }); } }
  else {
   const text = plain(raw), named = text.match(/^([^:\n]{1,100}):\s+([\s\S]+)$/);
   if (text) result.push({ start, end, speaker: named ? named[1].trim() : 'Unlabelled speaker', text: named ? named[2].trim() : text });
  }
 }
 return result.sort((a, b) => a.start - b.start);
}
export function normalizeUtterances(value: unknown): TranscriptSegment[] {
 if (!Array.isArray(value)) return [];
 return value.flatMap(item => {
  if (!item || typeof item.text !== 'string' || !item.text.trim() || !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end < item.start) return [];
  return [{ start: item.start, end: item.end, speaker: typeof item.speaker === 'string' && item.speaker ? `Speaker ${item.speaker.slice(0,100)}` : 'Unlabelled speaker', text: item.text.trim() }];
 });
}
