import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
} from "@/components/dashboard/family/FamilyDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { listParentChildRecordings } from "@/lib/live-classes/recordings";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
};

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date pending";
}

export default async function ParentRecordingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild = dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const recordings = selectedChild ? await listParentChildRecordings(session.user.id, selectedChild.id) : [];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Recordings"
      subtitle="Review completed live class recordings for each child."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard eyebrow="Child selector" title="Choose a learner">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/recordings"
        />
      </SectionCard>

      {selectedChild ? (
        <>
          <MetricGrid
            metrics={[
              { label: "Recordings", value: String(recordings.length), hint: "Available replays for this child." },
              { label: "Latest", value: recordings[0] ? formatDate(recordings[0].availableAt) : "None yet", hint: "Most recent recording." },
              { label: "Teacher linked", value: recordings.some((item) => item.teacherName) ? "Yes" : "Pending", hint: "Teacher shown per replay." },
              { label: "Programmes", value: String(new Set(recordings.map((item) => item.programTitle)).size), hint: "Courses with recordings." },
            ]}
          />

          <SectionCard eyebrow="Live class replays" title={`${selectedChild.name}'s recordings`}>
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div key={recording.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">{recording.programTitle}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{recording.title}</h3>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {recording.teacherName} • {formatDate(recording.recordingStart ?? recording.availableAt)}
                  </p>
                  <Link href={recording.playUrl} target="_blank" className="mt-4 inline-flex rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    Watch recording
                  </Link>
                </div>
              ))}
              {!recordings.length ? (
                <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                  Recordings will appear here after Zoom finishes processing completed classes for this child.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </>
      ) : null}
    </FamilyDashboardFrame>
  );
}
