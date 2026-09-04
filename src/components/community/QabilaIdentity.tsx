import Image from "next/image";

import { qabilaProfile } from "@/lib/community/qabilas";

export function QabilaIdentity({ name, compact = false }: { name?: string | null; compact?: boolean }) {
  const profile = qabilaProfile(name);
  if (!profile) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-white/95 shadow-sm ${compact ? "p-2" : "p-3"}`} style={{ borderColor: `${profile.color}55` }}>
      <Image src={profile.image} alt={`${profile.name} Qabila profile`} width={compact ? 52 : 72} height={compact ? 52 : 72} className={`${compact ? "h-13 w-13" : "h-18 w-18"} shrink-0 rounded-full object-cover ring-2 ring-white shadow-md`} />
      <div className="min-w-0">
        <p className="break-words font-bold text-[#22304a]">{profile.name}</p>
        <p className="mt-0.5 text-xs font-semibold" style={{ color: profile.color }}>{profile.mentor}</p>
      </div>
    </div>
  );
}