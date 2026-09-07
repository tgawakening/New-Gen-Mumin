import Image from "next/image";

export const DEFAULT_SUNNAH_MOTIVATION = "If you love Allah, then follow me; Allah will love you.";
export const DEFAULT_SUNNAH_SOURCE = "Qur'an 3:31";

export function SunnahMotivationBanner({ text, source }: { text?: string | null; source?: string | null }) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-[24px] border border-cyan-300/40 bg-[radial-gradient(circle_at_top,#173a87_0%,#081a3d_55%,#07132c_100%)] px-5 py-5 text-white shadow-[0_12px_35px_rgba(15,45,105,.2)] sm:pr-36">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,#67e8f9_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Little Sunnahs, big rewards</p>
        <p className="mt-2 max-w-2xl text-lg font-bold leading-7">"{text || DEFAULT_SUNNAH_MOTIVATION}"</p>
        <p className="mt-2 text-sm font-semibold text-cyan-200">{source || DEFAULT_SUNNAH_SOURCE}</p>
      </div>
      <Image src="/sunnah-icons/morning-dua.png" alt="Gen Mu'min learner practising a Sunnah" width={130} height={130} className="absolute -bottom-5 right-1 hidden h-32 w-32 object-contain sm:block" />
    </div>
  );
}
