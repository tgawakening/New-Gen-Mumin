export const PARENTAL_RECORDING_OPTION = "parental-sessions";
export function canUploadParentalRecording(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return user.email?.trim().toLowerCase() === "mehranraziq@gmail.com" || /\bmehran\b/i.test([user.firstName, user.lastName].filter(Boolean).join(" "));
}
