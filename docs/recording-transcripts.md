# Speaker-labelled recording transcripts

Admin > Recordings > Transcript provides three ways to obtain a document:
1. Import the matching Zoom transcript (only available when Zoom generated and retained it).
2. Upload a VTT/SRT transcript from another source.
3. Generate with AssemblyAI, when configured. This is an explicit admin action and may incur that provider's usage charges.

Review the timestamped preview, rename speakers you recognise, save names, then download a real Word .docx or UTF-8 .txt file. Word exports preserve Arabic/Urdu Unicode text and set right-to-left paragraphs. Unlabelled captions remain unlabelled; the software does not infer children's identities. Diarization can make mistakes with short turns, overlapping voices and shared microphones. No document is automatically emailed or posted to groups.

## AI setup

In the deployed application's secret environment variables, add ASSEMBLYAI_API_KEY. APP_URL must be the public HTTPS origin (for example https://genmumin.com). Redeploy after changing environment variables. Do not put the API key in NEXT_PUBLIC variables, source control, or the browser.

The integration uses POST /v2/transcript with speaker_labels=true, Universal-2 and automatic language detection or an explicit English/Urdu/Arabic selection. No AI call occurs when the key is absent. The account must have appropriate API access and billing. Existing Zoom transcripts and caption uploads do not require this key.

The provider receives a temporary, recording-specific media capability URL; it never receives Google Drive credentials. Its random token is stored only as a SHA-256 hash. Source requests support byte ranges, expire after 24 hours, and are disabled when the job completes/fails or the recording is deleted. Only administrators can start jobs, see transcripts, rename speakers, or download documents. The provider runs asynchronously; reopening the transcript page retrieves completed results. Polling is limited to once per 15 seconds per transcript on the server.

A row lock prevents duplicate submissions. If a network failure makes acceptance uncertain, the portal does not silently resubmit a paid job. Recover using the existing AssemblyAI job ID (its source is checked against this recording), or confirm in the provider dashboard that no job exists before clearing the request. Generated transcripts are retained locally; provider-side retention is controlled separately by that provider account.

## Deployment and validation

Apply migration 20261016120000_add_recording_transcripts before rollout and regenerate Prisma Client. No real recordings are sent to AI as part of code validation. Tests cover caption parsing, distinct voices, unknown voices, real OOXML ZIP output, Unicode, private source tokens, duplicate prevention, uncertain submissions, name validation and admin access.

References: https://www.assemblyai.com/docs/pre-recorded-audio/label-speakers and https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/submit
