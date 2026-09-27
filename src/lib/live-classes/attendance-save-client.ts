import type { RecoveryInput } from "@/lib/live-classes/admin-attendance";
import type { saveRecovery as saveAction } from "@/app/admin/attendance/actions";
export async function saveRecovery(input: RecoveryInput): Promise<Awaited<ReturnType<typeof saveAction>>> {
  try {
    const response = await fetch('/api/admin/attendance/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(90000) });
    const result = await response.json();
    if (!response.ok) return { data: null, error: result.error || 'Attendance could not be saved. Please retry.' };
    if (!result.data?.reportId) throw new Error('Missing saved receipt');
    return { data: result.data, error: '' };
  } catch {
    return { data: null, error: 'Save could not be confirmed. Check Recent recovery reports or retry safely; duplicate points are prevented.' };
  }
}
