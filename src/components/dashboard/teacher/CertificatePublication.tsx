import { changeCertificatePublication, hideWeeklyCertificates } from "@/app/teacher/certificate-actions";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";

export function CertificatePublicField() {
  return <label className="flex gap-3 rounded-2xl border border-[#d8e3ed] bg-[#f8fafc] p-4 text-sm lg:col-span-2"><input type="checkbox" name="isPublic" className="mt-1 h-4 w-4 shrink-0" /><span><strong>Make certificate public now</strong><span className="mt-1 block text-[#617184]">Checked: show in family portals, send email and add Qabila points. Unchecked: save privately for teacher preview; publish later. Certificates do not create badges.</span></span></label>;
}
export function CertificatePublicationControl({ id, isPublic, parent = false }: { id: string; isPublic: boolean; parent?: boolean }) {
  return <form action={changeCertificatePublication} className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><input type="hidden" name="awardId" value={id} /><input type="hidden" name="parent" value={String(parent)} /><label className="flex items-center gap-2"><input key={String(isPublic)} type="checkbox" name="isPublic" defaultChecked={isPublic} />Public</label><span className={isPublic ? "text-green-700" : "text-amber-800"}>{isPublic ? "Published" : "Private draft"}</span><FormSubmitButton pendingLabel="Saving..." className="rounded-full bg-[#22304a] px-3 py-2 text-xs font-bold text-white">Save visibility</FormSubmitButton></form>;
}
export function HideWeeklyCertificates() {
  return <details className="rounded-2xl border border-[#e7c9ae] bg-[#fffbf5] p-4"><summary className="cursor-pointer text-sm font-bold">Hide all existing weekly certificates</summary><form action={hideWeeklyCertificates} className="mt-3 grid gap-3 text-sm"><p>Hide all Mum and Mumin of the Week certificates from family portals, remove their notifications and withdraw their Qabila points. Teachers keep the certificates and can publish them individually later. Emails already delivered cannot be recalled.</p><label className="flex gap-2"><input type="checkbox" name="confirmHide" required />I confirm hiding all existing weekly certificates.</label><FormSubmitButton pendingLabel="Hiding..." className="w-fit rounded-full bg-[#22304a] px-4 py-2 font-bold text-white">Hide all weekly certificates</FormSubmitButton></form></details>;
}
