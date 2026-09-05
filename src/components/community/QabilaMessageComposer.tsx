"use client";

import { useState } from "react";

type Option = { id: string; label: string; preview?: string };
export function QabilaMessageComposer({ action, roomId, studentId, mentions, replies, buttonLabel = "Send message" }: { action: (formData: FormData) => void | Promise<void>; roomId: string; studentId?: string; mentions: Option[]; replies: Option[]; buttonLabel?: string }) {
  const [body, setBody] = useState("");
  const emojis = ["😊", "👍", "🌟", "👏", "🤲", "❤️"];
  return <form action={action} className="rounded-b-[24px] border-t border-[#dbe3ec] bg-white p-3 sm:p-4">
    <input type="hidden" name="roomId" value={roomId}/>{studentId ? <input type="hidden" name="studentId" value={studentId}/> : null}
    <div className="mb-2 grid gap-2 sm:grid-cols-2"><select name="replyToId" className="rounded-xl border border-[#d8e3ed] bg-[#f7f9fb] px-3 py-2 text-xs text-[#4d5a6b]"><option value="">Reply to a message…</option>{replies.map((item)=><option key={item.id} value={item.id}>{item.label}: {item.preview}</option>)}</select><select name="mentionName" className="rounded-xl border border-[#d8e3ed] bg-[#f7f9fb] px-3 py-2 text-xs text-[#4d5a6b]"><option value="">Tag a teammate or teacher…</option>{mentions.map((item)=><option key={item.id} value={item.label}>@{item.label}</option>)}</select></div>
    <textarea name="body" value={body} onChange={(event)=>setBody(event.target.value)} required maxLength={800} rows={2} placeholder="Write a friendly message…" className="w-full resize-none rounded-2xl border border-[#cfdbe7] px-4 py-3 text-sm text-[#22304a] outline-none focus:border-[#2a76aa]"/>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1">{emojis.map((emoji)=><button key={emoji} type="button" onClick={()=>setBody((value)=>`${value}${emoji}`)} className="rounded-lg px-2 py-1 text-lg hover:bg-[#f3f6f9]" aria-label={`Add ${emoji}`}>{emoji}</button>)}</div><button className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">{buttonLabel}</button></div>
  </form>;
}