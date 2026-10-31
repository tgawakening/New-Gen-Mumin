import { markCurriculumReviewed } from "@/lib/curriculum/review";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";

export function curriculumReviewIds(alerts: Array<{ id: string; href: string | null }>, kind: "lesson" | "material", contentId: string) {
  return alerts.filter((alert) => alert.href?.startsWith("/parent/curriculum?") && new URLSearchParams(alert.href.split("?")[1]).get(kind) === contentId).map((alert) => alert.id);
}
export function CurriculumReviewNotice({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return <form action={markCurriculumReviewed} className="my-3 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
    <input type="hidden" name="notificationIds" value={JSON.stringify(ids)} />
    <p className="flex-1 text-sm font-semibold text-red-800">New or updated content to review</p>
    <FormSubmitButton pendingLabel="Saving..." className="min-h-11 rounded-full bg-[#22304a] px-4 py-2 text-xs font-bold text-white">Mark reviewed</FormSubmitButton>
  </form>;
}
