/**
 * Shared site configuration.
 * Centralises nav, contact, and program links for consistency.
 */

export const SITE = {
  email: "info@globalawakening.co.uk",
  phone: "+447886398150",
  mainSite: "https://www.tga-awakening.com",
  globalAwakening: "https://globalawakening.co.uk",
  whatsapp: "https://chat.whatsapp.com/EX6fgdY6b4T9XRwpGNkfoU",
  /** Logo image. Set to "/images/gen-mumins-logo.png" when you have the logo file. */
  logoUrl: "/images/logo.png",
} as const;

/** Gen-Mumins Programs dropdown (live: Arabic Program, Seerah program, etc.) */
export const PROGRAMS = [
  { href: "/programs/arabic", label: "Arabic Program" },
  { href: "/programs/seerah", label: "Seerah program" },
  { href: "/programs/tajweed", label: "Qur'anic Tajweed Program" },
  { href: "/programs/life-lessons", label: "Life Lessons & Leadership Program" },
] as const;

/** Main nav items. Programs uses dropdown (see Header). */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/faqs", label: "Faq's" },
  { href: "/contact", label: "Contact" },
] as const;

export const PROGRAMS_LABEL = "Gen-Mumins Programs";

export const SECTION_IDS = {
  /** Programs section (live: #Genmumin). Used by Mission Explore More + hero Programme. */
  courses: "Genmumin",
  pricing: "pricing",
} as const;
