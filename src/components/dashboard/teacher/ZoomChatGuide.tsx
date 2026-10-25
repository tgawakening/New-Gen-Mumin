export function ZoomChatGuide() {
  return <details className="rounded-2xl border border-[#cbdce9] bg-[#f2f8ff] p-4 text-sm text-[#22304a]">
    <summary className="min-h-11 cursor-pointer font-bold">Class chat controls: pause student chat only</summary>
    <div className="mt-3 space-y-3 leading-6">
      <p>Open your class with <strong>Start as host</strong>. In Zoom, check that you are the host or co-host. Joining as a member does not give you chat controls.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>In the Zoom meeting, open <strong>Chat</strong>, then its <strong>More (…)</strong> menu.</li>
        <li>Under <strong>Participants can chat with</strong>, choose <strong>No one</strong> to pause chat. Your meeting, audio and video continue.</li>
        <li>When ready, return to the same menu and choose <strong>Everyone</strong> to allow class chat again.</li>
      </ol>
      <p>You can also check <strong>Host tools → Allow participants to → Chat</strong>. Menu names vary by Zoom version. If the controls are missing, ask the meeting host to make you a co-host.</p>
      <p>The portal opens the Zoom application; change live chat inside that meeting. <strong>Suspend participant activities</strong> stops other activities too.</p>
      <a href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064400" target="_blank" rel="noreferrer" className="inline-block font-semibold underline">Zoom chat instructions</a>
    </div>
  </details>;
}
