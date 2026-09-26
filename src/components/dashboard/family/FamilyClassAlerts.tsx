import Link from "next/link";
import { getUnreadNotifications, ensureParentLiveClassReminders, ensureStudentLiveClassReminders } from "@/lib/live-classes/notifications";
export async function FamilyClassAlerts({userId,role}:{userId:string;role:'parent'|'student'}){
 let notifications: Awaited<ReturnType<typeof getUnreadNotifications>> | null = null;
 try {
  if(role==='parent')await ensureParentLiveClassReminders(userId);else await ensureStudentLiveClassReminders(userId);
  notifications=await getUnreadNotifications(userId,5);
 }catch(error){console.error("Optional class alerts unavailable",error);}
 if(!notifications)return <p className="text-sm">Class alerts are temporarily unavailable. You can still use the class buttons above.</p>;
  if(!notifications.length)return null;
  return <details className="rounded-2xl border border-[#eadfce] bg-white p-4"><summary className="cursor-pointer font-semibold">Class updates ({notifications.length})</summary><div className="mt-3 space-y-2">{notifications.map(item=><Link prefetch={false} key={item.id} href={item.href??`/${role}/schedule`} className="block rounded-xl border p-3"><strong>{item.title}</strong><p className="text-sm">{item.body}</p></Link>)}</div></details>;
}
