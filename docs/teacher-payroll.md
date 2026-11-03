# Teacher payroll slips

## Admin workflow

Open Admin > Teacher Payroll (/admin/payroll), select a teacher and month, and open the proposed slip. September 2026 defaults were read from the Payroll - September, Rates & Assumptions and Teacher Summary tabs of https://docs.google.com/spreadsheets/d/1BUdE9iQDWEahKu9W3A7sg6_zgzgKLK9pkvkeRjfYKnw/edit?gid=1542663915 on 2 October 2026. The reference sheet is unchanged.

Edit programme rows, sessions, paid hours, GBP hourly rates, actual minutes, optional adjustment/reason, payment date, reference and teacher note. Changing sessions proposes one paid hour per session; paid hours can be edited independently. Actual minutes are a separate reference measure and do not determine pay. Future months propose rows from the teacher hours log and require admin review.

October 2026 defaults were read on 3 November 2026 from Payroll - October, Rates & Assumptions and Teacher Summary in https://docs.google.com/spreadsheets/d/1Km-j_E7sKGxlYlAqiZMZ92IOEYYFM5kdgcmpreeCNAs/edit. The reference is read-only. Approved defaults: Abdul Badee 25 paid hours / GBP 132.53; Abubakar 11 / 58.31; Afira 12 / 63.61; Javeria 11 / 58.31; Mehran 12 / 79.56, using October's Seerah rate 6.63. Arabic/Life Skills retain rate 5.30110263. Individual rounded payments total 392.32, while the sheet sums unrounded figures to 392.33; presets preserve each teacher's displayed payment rather than inventing a penny adjustment. Broken legacy columns P/Q and September audit notes in the October sheet are not used. Sister Saba is excluded from the supplied October sheet and receives no October preset. Unmatched October recipients start with empty figures and a review note rather than presumed hours.

Selecting October and a known recipient auto-loads these defaults only when no saved slip exists. Saved drafts/published slips are preserved. Load month defaults explicitly reloads the selected recipient's reference figures for review, retaining entered payment date, payment reference, note and receipt. September defaults remain available through their own month. Payment date and actual-paid confirmation remain mandatory to publish; deployment never publishes a payslip.

Maliha's requested GBP 50 October payment is a separate fixed-payment preset, not a value from the sheet. It uses an explicit 50.00 payment adjustment with a communications-support reason and zero teaching hours. Migration 20261103160000_maliha_payroll_recipient creates an inactive finance recipient profile for the existing active emancheman413@gmail.com Communications account only, if one is absent. It does not change the Communications role, activate teaching or grant finance access. Finance can select this recipient; her published slip appears in /communications and /communications/payroll. Receipt access and published-slip lookup remain scoped to the signed-in owner; payroll emails use the corresponding portal path.

Save draft keeps all changes private. After actual payment, confirm the payment checkbox and choose Publish paid payslip. The published snapshot appears at the top of the teacher dashboard and in Teacher > Payslips (/teacher/payroll). Subsequent draft edits do not change the published version. Publishing a revision retains the prior snapshot in TeacherPayslipRevision. Optimistic versions reject stale/replayed saves.

Teacher and Communications home pages show the latest slip expanded for five days after publication by default. Collapse/expand choice persists in browser storage, scoped to the user and published slip/revision; collapsing does not reopen automatically on refresh. After the five-day window it defaults to collapsed unless the recipient explicitly chose otherwise. Payroll slip history opens an accessible native dialog with selectable previous published months; direct month URLs remain available. Recipient-facing slips show approved paid hours/amounts and optional evidence prominently. Recorded teaching time is available only in a small, initially collapsed Teaching time reference at the bottom; payroll emails omit logged minutes. Admin inputs/previews retain actual time for reconciliation. The fixed-payment view does not invent sessions or paid hours.

## Amounts

GBP rates retain up to eight decimal places, paid hours four, and optional GBP adjustments two. Integer arithmetic calculates totals and rounds to pennies. Optional PKR equivalent uses the explicitly supplied dated conversion rate and rounds to whole rupees from the unrounded GBP amount, matching the September sheet. The source rate is 375.116 PKR per GBP dated 14 September 2026; it is not a live exchange-rate quote. Do not substitute a current conversion rate for a historical paid amount without admin review.

September expected GBP totals: Mehran 128.55; Afira 68.91; Abubakar 74.22; Abdul Badee 148.43; Sabah 13.25; Javeria 42.41. The total is GBP 475.77. Name matching is exact, with known aliases; unmatched teachers are not assigned another teacher's template automatically.

## Payment evidence

Paste the exact private teacher payroll folder link/ID in the admin editor. It is saved per teacher. The folder must be writable by the app's existing Google Drive account. No new folders or sharing permissions are created. Public and domain-shared destinations are rejected. The existing payroll folder was not found in the connected Drive search; its link is still needed for setup.

Optional PNG, JPEG, WebP or PDF evidence is limited to 8 MB and checked by signature and MIME type. Filenames/descriptions contain the teacher, payroll month and payment date. Teachers use authenticated view/download routes and can only retrieve their own published evidence. Drive IDs supplied in the browser payload are ignored. Finance admins can inspect draft evidence. Updating/removing a receipt in a draft does not delete historical Drive files.

## Deployment and checks

Migration 20261002120000_teacher_payslips adds TeacherPayrollSettings, TeacherPayslip and TeacherPayslipRevision. It is additive; it does not create or publish payment records. The scoped scripts/apply-teacher-payroll-migration.mjs runner performs a read-only preflight by default and applies only this migration with --apply and an environment-supplied DATABASE_URL. No credentials are stored in the script.

Run node --test scripts/test-payroll.mjs, ESLint on payroll files, and npm run build. Live upload testing requires the actual payroll folder and app Drive permissions. No teacher payslip is published by deployment itself.
