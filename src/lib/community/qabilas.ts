export const QABILA_PROFILES = {
  "Maryam bint Imran": { legacyName: "Girls Qabila A", gender: "GIRLS", mentor: "Sister Saba", color: "#c96486", image: "/qabilas/maryam-bint-imran.png" },
  "Khadijah bint Khuwaylid": { legacyName: "Girls Qabila B", gender: "GIRLS", mentor: "Sister Aisha", color: "#8056b3", image: "/qabilas/khadijah-bint-khuwaylid.png" },
  "Abubakr ibn Abi Qahafa": { legacyName: "Boys Qabila A", gender: "BOYS", mentor: "Ustadh Mehran", color: "#2368b5", image: "/qabilas/abubakr-ibn-abi-qahafa.png" },
  "Umar Ibn Al Khattab": { legacyName: "Boys Qabila B", gender: "BOYS", mentor: "Ustadh Abdel Badea", color: "#168264", image: "/qabilas/umar-ibn-al-khattab.png" },
} as const;

export type QabilaName = keyof typeof QABILA_PROFILES;
const legacyToCurrent = new Map<string, QabilaName>(Object.entries(QABILA_PROFILES).map(([name, profile]) => [profile.legacyName, name as QabilaName]));

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
export const LEGACY_QABILA_NAMES = Object.values(QABILA_PROFILES).map((profile) => profile.legacyName);