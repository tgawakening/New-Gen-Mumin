"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { AttendanceConfirmationError, confirmParentAttendance } from "@/lib/live-classes/parent-attendance";

export type AttendanceConfirmationState = { message: string; error: string };
const inputSchema = z.object({
  studentId: z.string().min(1).max(191),
  changes: z.array(z.object({ key: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(["PRESENT", "ABSENT"]) })).min(1).max(100),
});

export async function saveAttendanceConfirmations(_previous: AttendanceConfirmationState, form: FormData): Promise<AttendanceConfirmationState> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "PARENT") return { message: "", error: "Please sign in to your parent account." };
  if (form.get("confirmed") !== "yes") return { message: "", error: "Please confirm that your selections are accurate." };
  let input: z.infer<typeof inputSchema>;
  try {
    const raw = String(form.get("changes") ?? "");
    if (raw.length > 20000) throw new Error("Too many changes");
    input = inputSchema.parse({ studentId: form.get("studentId"), changes: JSON.parse(raw) });
  } catch { return { message: "", error: "Choose valid attendance dates before saving." }; }
  try {
    const result = await confirmParentAttendance(session.user.id, input.studentId, input.changes);
    revalidatePath("/parent", "layout");
    revalidatePath("/student", "layout");
    revalidatePath("/teacher/attendance");
    revalidatePath("/admin/rewards");
    return { error: "", message: `${result.saved} class date(s) saved. ${result.pointsDelta > 0 ? "+" : ""}${result.pointsDelta} points. Attendance and points history are updated.` };
  } catch (error) {
    if (error instanceof AttendanceConfirmationError) return { message: "", error: error.message };
    console.error("Parent attendance confirmation failed", error);
    return { message: "", error: "We could not save these changes. Please try again; repeated saves will not duplicate points." };
  }
}
