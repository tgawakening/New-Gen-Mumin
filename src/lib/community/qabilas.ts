export const QABILA_PROFILES = {
  "Qabila Banu Makhzum": { legacyNames: ["Girls Qabila A", "Maryam bint Imran"], gender: "GIRLS", mentor: "Sister Saba", color: "#9f2349", image: "/qabilas/qabila-banu-makhzum.png" },
  "Qabila Banu Zuhra": { legacyNames: ["Girls Qabila B", "Khadijah bint Khuwaylid"], gender: "GIRLS", mentor: "Sister Aisha", color: "#6d247a", image: "/qabilas/qabila-banu-zuhra.png" },
  "Qabila Banu Hashim": { legacyNames: ["Boys Qabila A", "Abubakr ibn Abi Qahafa"], gender: "BOYS", mentor: "Ustadh Mehran", color: "#07509b", image: "/qabilas/qabila-banu-hashim.png" },
  "Qabila Banu Asad": { legacyNames: ["Boys Qabila B", "Umar Ibn Al Khattab"], gender: "BOYS", mentor: "Ustadh Abdel Badea", color: "#087242", image: "/qabilas/qabila-banu-asad.png" },
} as const;

export type QabilaName = keyof typeof QABILA_PROFILES;
const legacyToCurrent = new Map<string, QabilaName>(
  Object.entries(QABILA_PROFILES).flatMap(([name, profile]) =>
    profile.legacyNames.map((legacyName) => [legacyName, name as QabilaName] as const),
  ),
);

export function canonicalQabilaName(value?: string | null): QabilaName | null {
  if (!value) return null;
  if (value in QABILA_PROFILES) return value as QabilaName;
  return legacyToCurrent.get(value) ?? null;
}

export function qabilaProfile(value?: string | null) {
  const name = canonicalQabilaName(value);
  return name ? { name, ...QABILA_PROFILES[name] } : null;
}

export const QABILA_NAMES = Object.keys(QABILA_PROFILES) as QabilaName[];
export const LEGACY_QABILA_NAMES = Object.values(QABILA_PROFILES).flatMap((profile) => [...profile.legacyNames]);