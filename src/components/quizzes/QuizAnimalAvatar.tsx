import { quizAvatar } from "@/lib/quizzes/avatars";

const emojiSizes = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-6xl",
} as const;

const badgeSizes = {
  sm: "text-[9px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
} as const;

export function QuizAnimalAvatar({
  avatarId,
  className = "h-16 w-16",
  animated = false,
  size = "md",
}: {
  avatarId?: string | null;
  className?: string;
  animated?: boolean;
  size?: keyof typeof emojiSizes;
}) {
  const avatar = quizAvatar(avatarId);
  return (
    <span
      role="img"
      aria-label={avatar.name}
      title={avatar.name}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] border-2 border-white/80 shadow-sm ${className}`}
      style={{ background: `linear-gradient(145deg, ${avatar.accent}33, ${avatar.accent}88)` }}
    >
      <span className={`${emojiSizes[size]} ${animated ? "animate-bounce" : ""}`}>{avatar.emoji}</span>
      <span className={`absolute right-0 top-0 rounded-bl-lg bg-white/90 px-1 leading-relaxed ${badgeSizes[size]}`}>{avatar.badge}</span>
    </span>
  );
}
