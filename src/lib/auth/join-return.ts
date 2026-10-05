/** Allow only known local post-login destinations. */
export function safeJoinReturn(value: unknown) {
  return typeof value === "string" && (/^\/join\/[a-zA-Z0-9_-]{1,128}$/.test(value) || /^\/teacher\/payroll\?month=20\d{2}-(0[1-9]|1[0-2])$/.test(value)) ? value : null;
}
