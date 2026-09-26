import type { previewRecovery } from "@/app/admin/attendance/actions";
export async function requestAttendancePreview(studentId: string, from: string, to: string): Promise<Awaited<ReturnType<typeof previewRecovery>>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`/api/admin/attendance/preview?${new URLSearchParams({ studentId, from, to })}`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
      if (response.status >= 500 && attempt === 0) continue;
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error || "Unable to load this learner. Please retry Preview." };
      if (!result.data || !Array.isArray(result.data.sessions) || typeof result.data.fingerprint !== 'string') throw new Error('Invalid preview response');
      return { data: result.data, error: '' };
    } catch {
      if (attempt === 1) return { data: null, error: "The preview request could not reach the server or timed out. Your attendance has not changed. Retry Preview; if this continues, refresh the page and sign in again." };
    }
  }
  return { data: null, error: "Unable to load attendance. Please retry Preview." };
}
