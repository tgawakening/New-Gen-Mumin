export const ADMIN_MULTI_PROGRAM_COUPON = "PKMULTI3K";
export function validateAdminProgramSelection(slugs: string[], offers: { slug: string; programSlugs: string[] }[]) {
  if (!slugs.length) throw new Error("Select at least one programme offer.");
  const programs = new Set<string>();
  for (const slug of slugs) {
    const offer = offers.find(item => item.slug === slug);
    if (!offer || !offer.programSlugs.length) throw new Error("A selected programme offer is unavailable.");
    for (const program of offer.programSlugs) {
      if (programs.has(program)) throw new Error("Selected offers overlap. Choose each programme only once.");
      programs.add(program);
    }
  }
  return [...programs];
}
export function adminMultiProgramDiscount(input: { couponCode: string; countryCode: string; studentCount: number; programSlugs: string[] }) {
  if (input.couponCode !== ADMIN_MULTI_PROGRAM_COUPON) return null;
  if (input.countryCode.toUpperCase() !== "PK" || input.studentCount !== 1 || ![2, 3].includes(input.programSlugs.length)) throw new Error("PKMULTI3K requires one Pakistani student with two or three programmes. Select one child for this order.");
  return 3000;
}
