import Image from "next/image";
import { Code2, HeartHandshake, MessageCircle, Phone, Users } from "lucide-react";

const TEAM = [
  { name: "Areej Irshad", role: "Web Developer & Technical Assistant", image: "/images/team-hijabi.svg", icon: Code2,
    bio: "Develops and supports the Gen-Mumin website and portals. Get help with login, portal access or other technical issues.",
    help: "Technical help", phone: "+92 326 2055614", dial: "+923262055614" },
  { name: "Sister Maliha", role: "Communications Lead", image: null, icon: MessageCircle,
    bio: "Helps families with course enquiries, class timings and general questions, and keeps Gen-Mumin updates and follow-ups organised.",
    help: "Course & timing enquiries", phone: "+92 319 1180546", dial: "+923191180546" },
  { name: "Ustadh Mehran Raziq", role: "Project Manager & Programme Lead", image: "/images/ustad-mehran.png", icon: Users,
    bio: "Coordinates programme delivery and supports the teaching team, alongside teaching Seerah and parental sessions.",
    help: "Programme leadership", phone: null, dial: null },
  { name: "Sister Saba", role: "Community Builder & Project Assistant", image: null, icon: HeartHandshake,
    bio: "Helps families feel connected through community activities, supports parent engagement and assists with project coordination.",
    help: "Community & family engagement", phone: null, dial: null },
];

export function MeetTeamSection() {
  return (
    <section id="team" aria-labelledby="team-heading" className="scroll-mt-28 bg-[#f5f8fa] py-14 md:py-20">
      <div className="section-container">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-semibold text-[#a34b16]">Here to support your family</p>
          <h2 id="team-heading" className="text-3xl font-bold text-[#21314d] md:text-4xl">Meet the Gen-Mumin team</h2>
          <p className="mt-4 leading-relaxed text-slate-600">Need a hand? Contact Areej for portal and technical help, or Sister Maliha for courses, timings and general enquiries.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map(member => {
            const Icon = member.icon;
            return (
              <article key={member.name} className="flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff1dc]">
                    {member.image ? <Image src={member.image} alt={member.name === "Areej Irshad" ? "Hijabi developer illustration" : ""} width={80} height={80} className="h-20 w-20 object-contain" /> : <Icon aria-hidden="true" className="h-9 w-9 text-[#94521d]" />}
                  </div>
                  <span className="text-xs font-semibold leading-5 text-[#94521d]">{member.help}</span>
                </div>
                <h3 className="text-xl font-bold text-[#21314d]">{member.name}</h3>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#94521d]">{member.role}</p>
                <p className="mb-6 mt-3 text-sm leading-6 text-slate-600">{member.bio}</p>
                {member.dial && <div className="mt-auto space-y-3 border-t border-slate-100 pt-4">
                  <a href={"tel:" + member.dial} aria-label={"Call " + member.name + " on " + member.phone} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#21314d] hover:underline"><Phone aria-hidden="true" className="h-4 w-4 shrink-0" />{member.phone}</a>
                  <a href={"https://wa.me/" + member.dial.slice(1)} target="_blank" rel="noopener noreferrer" aria-label={"Message " + member.name + " on WhatsApp"} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#21314d] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#32486b]"><MessageCircle aria-hidden="true" className="h-4 w-4" />Message on WhatsApp</a>
                </div>}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
