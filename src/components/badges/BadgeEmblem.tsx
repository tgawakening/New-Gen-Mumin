import { BookOpen, HeartHandshake, Repeat2, ShieldCheck, Star, Trophy, Eye, Flag, HandHeart, Sparkles } from "lucide-react";

export function BadgeEmblem({ badgeKey, title, className = "h-16 w-16" }: { badgeKey: string; title: string; className?: string }) {
  const Icon = badgeKey === "RELIABLE" ? ShieldCheck : badgeKey === "CONSISTENT" ? Repeat2 : badgeKey === "SEEKER" ? BookOpen : badgeKey === "HELPER" ? HeartHandshake : badgeKey === "MUMIN_OF_WEEK" ? Trophy : badgeKey === "NOTICER" ? Eye : badgeKey === "LEADER" ? Flag : badgeKey.includes("HOUSE") || badgeKey === "ALLIANCE_CHAMPION" ? HandHeart : badgeKey === "COURAGEOUS" ? Sparkles : Star;
  return <span role="img" aria-label={`${title} badge`} className={`inline-flex shrink-0 items-center justify-center rounded-full border-4 border-[#d5af5b] bg-gradient-to-br from-[#fff8d9] to-[#efd49a] text-[#775115] shadow-sm ${className}`}><Icon aria-hidden="true" className="h-1/2 w-1/2" strokeWidth={1.6} /></span>;
}

export function notificationBadge(href: string | null) {
  if (!href?.startsWith("/teacher/recognition?")) return null;
  const key = new URLSearchParams(href.split("?")[1].split("#")[0]).get("badgeImage");
  return key && ["MUMIN_OF_WEEK", "RELIABLE", "HELPER", "COURAGEOUS", "SEEKER", "NOTICER", "TRUTH_TELLER", "CONSISTENT", "LEADER", "HOUSE_BUILDER", "ALLIANCE_CHAMPION"].includes(key) ? key : null;
}

export function NotificationBadge({ href, title }: { href: string | null; title: string }) {
  const key = notificationBadge(href);
  return key ? <span className="mb-2 block"><BadgeEmblem badgeKey={key} title={title} className="h-12 w-12" /></span> : null;
}
