import Link from "next/link";
import { Award, BookOpen, ClipboardList, FolderOpen, Sparkles, Video } from "lucide-react";
import { TeacherLiveRewardBadge } from "./TeacherLiveClassProvider";

export function TeacherTeachingTools({ canAwardCertificates }: { canAwardCertificates: boolean }) {
  const tools = [
    { title: canAwardCertificates ? "Badges & Certificates" : "Badges & Live Points", description: canAwardCertificates ? "Award student badges and weekly certificates." : "Celebrate student character and class contributions.", href: "/teacher/recognition", Icon: Award, live: true },
    { title: "Curriculum Builder", description: "Plan lessons and organise your programme.", href: "/teacher/course-builder", Icon: BookOpen },
    { title: "Homework & Assignments", description: "Set homework and review student submissions.", href: "/teacher/homework", Icon: ClipboardList },
    { title: "Live House Points", description: "Award points for effort during class.", href: "/teacher/house-points", Icon: Sparkles },
    { title: "Live Sessions", description: "Start and manage your Zoom classes.", href: "/teacher/live-sessions", Icon: Video },
    { title: "Teaching Materials", description: "Share worksheets and learning resources.", href: "/teacher/materials", Icon: FolderOpen },
  ];
  return <section aria-labelledby="teaching-tools" className="rounded-3xl border border-[#eadfce] bg-white p-5 sm:p-6">
    <h2 id="teaching-tools" className="text-2xl font-bold text-[#22304a]">Your teaching tools</h2>
    <p className="mt-2 text-sm text-[#617184]">Plan a lesson, teach your class, then celebrate progress.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tools.map(({ title, description, href, Icon, live }) => <Link key={href} href={href} className="relative flex min-h-28 gap-3 rounded-2xl border border-[#e4d9c8] bg-[#fffbf5] p-4 transition hover:border-[#c3924b] hover:bg-[#fff3de] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a]">
      <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[#aa6822]" /><span><strong className="block text-[#22304a]">{title}</strong><span className="mt-2 block text-sm leading-6 text-[#617184]">{description}</span></span>{live ? <TeacherLiveRewardBadge /> : null}
    </Link>)}</div>
  </section>;
}
