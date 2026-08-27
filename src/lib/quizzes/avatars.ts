export const QUIZ_AVATARS = [
  { id: "giggle-lion", name: "Giggle Lion", emoji: "🦁", badge: "⭐", accent: "#f59e0b" },
  { id: "clever-fox", name: "Clever Fox", emoji: "🦊", badge: "✨", accent: "#f97316" },
  { id: "happy-panda", name: "Happy Panda", emoji: "🐼", badge: "🎋", accent: "#334155" },
  { id: "bouncy-bunny", name: "Bouncy Bunny", emoji: "🐰", badge: "🥕", accent: "#f472b6" },
  { id: "cheeky-monkey", name: "Cheeky Monkey", emoji: "🐵", badge: "🍌", accent: "#a16207" },
  { id: "cool-tiger", name: "Cool Tiger", emoji: "🐯", badge: "⚡", accent: "#ea580c" },
  { id: "wise-owl", name: "Wise Owl", emoji: "🦉", badge: "📚", accent: "#7c3aed" },
  { id: "dancing-penguin", name: "Dancing Penguin", emoji: "🐧", badge: "🎵", accent: "#0284c7" },
  { id: "brave-bear", name: "Brave Bear", emoji: "🐻", badge: "🏆", accent: "#92400e" },
  { id: "smiling-frog", name: "Smiling Frog", emoji: "🐸", badge: "🌈", accent: "#16a34a" },
  { id: "playful-koala", name: "Playful Koala", emoji: "🐨", badge: "🌿", accent: "#64748b" },
  { id: "magic-unicorn", name: "Magic Unicorn", emoji: "🦄", badge: "💫", accent: "#a855f7" },
] as const;

export type QuizAvatarId = (typeof QUIZ_AVATARS)[number]["id"];

export function quizAvatar(id?: string | null, _gender?: string | null) {
  return QUIZ_AVATARS.find((avatar) => avatar.id === id) ?? QUIZ_AVATARS[0];
}

export function quizAnimalAvatars() {
  return QUIZ_AVATARS;
}
