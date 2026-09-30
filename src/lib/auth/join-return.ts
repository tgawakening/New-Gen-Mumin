/** Only public class join pages are accepted as post-login destinations. */
export function safeJoinReturn(value: unknown) {
  return typeof value === "string" && /^\/join\/[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
}
