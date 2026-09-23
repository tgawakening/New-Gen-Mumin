import "server-only";

export async function loadOptionalDashboardSection<T>(label: string, load: () => Promise<T>, fallback: T): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await load(), unavailable: false };
  } catch (error) {
    console.error("Optional dashboard section unavailable: " + label, error);
    return { data: fallback, unavailable: true };
  }
}
