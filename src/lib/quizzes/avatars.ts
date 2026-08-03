export const QUIZ_AVATARS = [
  { id: "ali-rocket", gender: "male", name: "Rocket Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🚀", accent: "#2563eb" },
  { id: "ali-dino", gender: "male", name: "Dino Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🦖", accent: "#16a34a" },
  { id: "ali-robot", gender: "male", name: "Robot Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🤖", accent: "#64748b" },
  { id: "ali-lion", gender: "male", name: "Lion Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🦁", accent: "#f59e0b" },
  { id: "ali-space", gender: "male", name: "Space Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🪐", accent: "#7c3aed" },
  { id: "ali-ninja", gender: "male", name: "Ninja Ali", image: "/gen-mumin-chars/ali-superhero.png", badge: "🥷", accent: "#0f172a" },
  { id: "rania-star", gender: "female", name: "Star Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🌟", accent: "#db2777" },
  { id: "rania-bunny", gender: "female", name: "Bunny Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🐰", accent: "#f472b6" },
  { id: "rania-robot", gender: "female", name: "Robot Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🤖", accent: "#64748b" },
  { id: "rania-panda", gender: "female", name: "Panda Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🐼", accent: "#334155" },
  { id: "rania-space", gender: "female", name: "Space Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🪐", accent: "#7c3aed" },
  { id: "rania-unicorn", gender: "female", name: "Unicorn Rania", image: "/gen-mumin-chars/rania-superhero.png", badge: "🦄", accent: "#a855f7" },
] as const;

export type QuizAvatarId = (typeof QUIZ_AVATARS)[number]["id"];

export function normalizedQuizGender(gender?: string | null) {
  const value = gender?.trim().toLowerCase() ?? "";
  return value.includes("female") || value.includes("girl") || value === "f" ? "female" : "male";
}

export function quizAvatar(id?: string | null, gender?: string | null) {
  return QUIZ_AVATARS.find((avatar) => avatar.id === id)
    ?? QUIZ_AVATARS.find((avatar) => avatar.gender === normalizedQuizGender(gender))
    ?? QUIZ_AVATARS[0];
}

export function quizAvatarsForGender(gender?: string | null) {
  const normalized = normalizedQuizGender(gender);
  return QUIZ_AVATARS.filter((avatar) => avatar.gender === normalized);
}