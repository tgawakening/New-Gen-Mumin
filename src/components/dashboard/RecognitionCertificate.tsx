import Image from "next/image";
import { Award, HeartHandshake, Sparkles, Star } from "lucide-react";
import styles from "./RecognitionCertificate.module.css";

type Props = {
  kind: "mum" | "boy" | "girl" | "neutral";
  name: string; title: string; recognition: string; evidence: string;
  week?: string; date: string; teacher: string; code: string; qabila?: string;
};

export function RecognitionCertificate(props: Props) {
  const mum = props.kind === "mum";
  const character = props.kind === "neutral" ? null : "/gen-mumin-chars/" + props.kind + "-certificate-" + (mum ? "v1" : "v2") + ".png";
  return <div data-certificate-artwork data-theme={props.kind} className={styles.artwork}>
    <div className={styles.sheet}>
      <aside className={styles.rail} aria-hidden="true">
        <div className={styles.railBrand}>GEN-MUMIN<span>Growing in goodness</span></div>
        <div className={styles.orbit} />
        {character ? <Image unoptimized src={character} alt="" width={1024} height={1536} className={styles.character} /> : <Star className={styles.neutralStar} />}
        <div className={styles.railCaption}>{mum ? "A heart that nurtures." : "Small actions."}<br />{mum ? "A legacy of goodness." : "Beautiful character."}</div>
      </aside>
      <div className={styles.content}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>GENERATION MUMIN</p><p className={styles.subline}>{mum ? "Celebrating the mothers behind the journey" : "Faith. Kindness. Character."}</p></div>
          <div className={styles.seal}>{mum ? <HeartHandshake /> : <Award />}<span>WITH HONOUR</span></div>
        </header>
        <div className={styles.heading}>
          <p className={styles.eyebrow}><Sparkles /> {mum ? "A celebration of care" : "A celebration of character"}</p>
          <h1>{props.title}</h1>
          {props.week && <p className={styles.week}>{props.week}</p>}
        </div>
        <section className={styles.citation} aria-label="Reason for this award">
          <p className={styles.citationLabel}><Sparkles aria-hidden="true" /> The goodness we celebrate</p>
          {props.recognition !== props.title && <p className={styles.recognition}>{props.recognition}</p>}
          <p className={`${styles.evidence} ${props.evidence.length > 350 ? styles.longEvidence : props.evidence.length > 180 ? styles.mediumEvidence : ""}`}><strong>{props.evidence}</strong></p>
        </section>
        <div className={styles.recipient}>
          <p className={styles.eyebrow}>{mum ? "With heartfelt appreciation for" : "Proudly presented to"}</p>
          <h2 className={props.name.length > 32 ? styles.longName : undefined}>{props.name}</h2>
          <div className={styles.goldLine} />
          {props.qabila && <p className={styles.qabila}>{props.qabila}</p>}
        </div>
        <p className={styles.blessing}>{mum ? "May Allah bless your care, patience and every quiet effort." : "May Allah bless your efforts and help your goodness grow."}</p>
        <footer className={styles.footer}>
          <div><strong>{props.date}</strong><span>Date awarded</span></div>
          <div className={styles.signature}><strong>{props.teacher}</strong><span>Gen-Mumin faculty</span></div>
        </footer>
        <div className={styles.reference}><span>{mum ? "Nurturing faith. Inspiring generations." : "Character is the achievement that lasts."}</span><span>ID {props.code.slice(-8).toUpperCase()}</span></div>
      </div>
    </div>
  </div>;
}
