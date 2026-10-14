import Image from "next/image";
import { BookOpen, HeartHandshake, Repeat2, ShieldCheck, Sparkles, Star, Trophy } from "lucide-react";
import styles from "./EarnedBadgeArtwork.module.css";
import { qabilaProfile } from "@/lib/community/qabilas";

export type EarnedBadgeProps = { name: string; title: string; badgeKey: string; reason: string; qabila?: string | null; gender?: string | null; date: string };
export function EarnedBadgeArtwork({ name, title, badgeKey, reason, qabila, gender, date }: EarnedBadgeProps) {
  const resolved = qabilaProfile(qabila)?.gender.toLowerCase() || gender?.toLowerCase() || "";
  const kind = resolved.includes("girl") || resolved.includes("female") ? "girl" : resolved.includes("boy") || resolved.includes("male") ? "boy" : "neutral";
  const Icon = badgeKey === "RELIABLE" ? ShieldCheck : badgeKey === "CONSISTENT" ? Repeat2 : badgeKey === "SEEKER" ? BookOpen : badgeKey === "HELPER" ? HeartHandshake : badgeKey === "MUMIN_OF_WEEK" ? Trophy : Star;
  return <div data-badge-artwork data-theme={kind} className={styles.artwork}>
    <div className={styles.body}>
      <p className={styles.brand}>GEN-MUMIN <span>CHARACTER COLLECTION</span></p>
      <div className={styles.illustration}>
        <div className={styles.halo} />
        {kind !== "neutral" && <Image unoptimized src={"/gen-mumin-chars/" + kind + "-certificate-v2.png"} alt="" width={1024} height={1536} className={styles.character} />}
        <div className={styles.medal}><Icon aria-hidden="true" /><span>WELL EARNED</span></div>
        <Sparkles aria-hidden="true" className={styles.sparkle} />
      </div>
      <p className={styles.eyebrow}>A little badge. A beautiful achievement.</p>
      <h2>{title}</h2>
      <p className={styles.name}>{name}</p>
      <p className={styles.reason}>{reason}</p>
      {qabila && <p className={styles.qabila}>{qabilaProfile(qabila)?.name || qabila}</p>}
      <div className={styles.footer}><span>Keep growing in goodness</span><span>{date}</span></div>
    </div>
  </div>;
}
