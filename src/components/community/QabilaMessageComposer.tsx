"use client";

import { useMemo, useState } from "react";

 type Option = { id: string; label: string; preview?: string };

export function QabilaMessageComposer({ action, roomId, studentId, mentions, replyTo, buttonLabel = "Send message" }: { action: (formData: FormData) => void | Promise<void>; roomId: string; studentId?: string; mentions: Option[]; replyTo?: Option | null; buttonLabel?: string }) {
  const [body, setBody] = useState("");
  const [selectedMention, setSelectedMention] = useState<Option | null>(null);
  const mentionMatch = body.match(/(?:^|\s)@([^@\n]*)$/);
  const mentionQuery = mentionMatch?.[1]?.trim().toLowerCase() ?? null;
  const suggestions = useMemo(() => mentionQuery === null ? [] : mentions.filter((item) => item.label.toLowerCase().includes(mentionQuery)).slice(0, 8), [mentionQuery, mentions]);
  const emojis = ["\u{1F60A}", "\u{1F44D}", "\u{1F31F}", "\u{1F44F}", "\u{1F932}", "\u{2764}\u{FE0F}"];

  function chooseMention(option: Option) {
    const match = body.match(/(?:^|\s)@([^@\n]*)$/);
    if (!match || match.index === undefined) return;
    const leadingSpace = body[match.index] === " " ? " " : "";
    setBody(`${body.slice(0, match.index)}${leadingSpace}@${option.label} `);
    setSelectedMention(option);
  }

  return <form action={action} className="rounded-b-[24px] border-t border-[#dbe3ec] bg-white p-3 sm:p-4">
    <input type="hidden" name="roomId" value={roomId}/>
    {studentId ? <input type="hidden" name="studentId" value={studentId}/> : null}
    {replyTo ? <input type="hidden" name="replyToId" value={replyTo.id}/> : null}
    {selectedMention ? <><input type="hidden" name="mentionedUserId" value={selectedMention.id}/><input type="hidden" name="mentionName" value={selectedMention.label}/></> : null}
    {replyTo ? <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border-l-4 border-[#2a76aa] bg-[#eef6ff] px-3 py-2 text-xs text-[#4d5a6b]"><div><strong className="text-[#22304a]">Replying to {replyTo.label}</strong><p className="mt-0.5 line-clamp-1">{replyTo.preview}</p></div><a href="#qabila-composer" className="font-bold text-[#617184]" aria-label="Cancel reply">x</a></div> : null}
    <div className="relative">
      <textarea id="qabila-composer" name="body" value={body} onChange={(event) => { setBody(event.target.value); if (selectedMention && !event.target.value.includes(`@${selectedMention.label}`)) setSelectedMention(null); }} required maxLength={800} rows={3} placeholder="Write a message... Type @ to tag a teammate or teacher" autoComplete="off" className="w-full resize-none rounded-2xl border border-[#cfdbe7] px-4 py-3 text-sm text-[#22304a] outline-none focus:border-[#2a76aa]"/>
      {suggestions.length ? <div className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#d7e1eb] bg-white p-2 shadow-[0_16px_40px_rgba(18,36,62,0.2)] sm:max-w-sm">
        <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a6a3a]">Tag a Qabila member</p>
        {suggestions.map((item) => <button key={item.id} type="button" onClick={() => chooseMention(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#22304a] transition hover:bg-[#eef6ff] focus:bg-[#eef6ff]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#102544] text-sm font-black text-[#ffc96c]">{item.label.slice(0, 1).toUpperCase()}</span><span>@{item.label}</span></button>)}
      </div> : null}
    </div>
    {selectedMention ? <div className="mt-2 flex items-center justify-between rounded-xl bg-[#eef6ff] px-3 py-2 text-xs text-[#245f8d]"><span><strong>@{selectedMention.label}</strong> will be notified by email.</span><button type="button" onClick={() => setSelectedMention(null)} className="font-bold">Remove tag</button></div> : <p className="mt-1 px-1 text-[11px] text-[#7a8797]">Tip: type @ to choose and notify one Qabila member.</p>}
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1">{emojis.map((emoji)=><button key={emoji} type="button" onClick={()=>setBody((value)=>`${value}${emoji}`)} className="rounded-lg px-2 py-1 text-lg hover:bg-[#f3f6f9]" aria-label={`Add ${emoji}`}>{emoji}</button>)}</div><button className="rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">{buttonLabel}</button></div>
  </form>;
}