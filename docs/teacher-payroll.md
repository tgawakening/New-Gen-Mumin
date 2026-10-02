# Teacher payroll slips

## Admin workflow

Open Admin > Teacher Payroll (/admin/payroll), select a teacher and month, and open the proposed slip. September 2026 defaults were read from the Payroll - September, Rates & Assumptions and Teacher Summary tabs of https://docs.google.com/spreadsheets/d/1BUdE9iQDWEahKu9W3A7sg6_zgzgKLK9pkvkeRjfYKnw/edit?gid=1542663915 on 2 October 2026. The reference sheet is unchanged.

Edit programme rows, sessions, paid hours, GBP hourly rates, actual minutes, optional adjustment/reason, payment date, reference and teacher note. Changing sessions proposes one paid hour per session; paid hours can be edited independently. Actual minutes are a separate reference measure and do not determine pay. Future months propose rows from the teacher hours log and require admin review.

Save draft keeps all changes private. After actual payment, confirm the payment checkbox and choose Publish paid payslip. The published snapshot appears at the top of the teacher dashboard and in Teacher > Payslips (/teacher/payroll). Subsequent draft edits do not change the published version. Publishing a revision retains the prior snapshot in TeacherPayslipRevision. Optimistic versions reject stale/replayed saves.

## Amounts

GBP rates retain up to eight decimal places, paid hours four, and optional GBP adjustments two. Integer arithmetic calculates totals and rounds to pennies. Optional PKR equivalent uses the explicitly supplied dated conversion rate and rounds to whole rupees from the unrounded GBP amount, matching the September sheet. The source rate is 375.116 PKR per GBP dated 14 September 2026; it is not a live exchange-rate quote. Do not substitute a current conversion rate for a historical paid amount without admin review.

September expected GBP totals: Mehran 128.55; Afira 68.91; Abubakar 74.22; Abdul Badee 148.43; Sabah 13.25; Javeria 42.41. The total is GBP 475.77. Name matching is exact, with known aliases; unmatched teachers are not assigned another teacher's template automatically.

## Payment evidence

Paste the exact private teacher payroll folder link/ID in the admin editor. It is saved per teacher. The folder must be writable by the app's existing Google Drive account. No new folders or sharing permissions are created. Public and domain-shared destinations are rejected. The existing payroll folder was not found in the connected Drive search; its link is still needed for setup.

Optional PNG, JPEG, WebP or PDF evidence is limited to 8 MB and checked by signature and MIME type. Filenames/descriptions contain the teacher, payroll month and payment date. Teachers use authenticated view/download routes and can only retrieve their own published evidence. Drive IDs supplied in the browser payload are ignored. Finance admins can inspect draft evidence. Updating/removing a receipt in a draft does not delete historical Drive files.

## Deployment and checks

Migration 20261002120000_teacher_payslips adds TeacherPayrollSettings, TeacherPayslip and TeacherPayslipRevision. It is additive; it does not create or publish payment records. The scoped scripts/apply-teacher-payroll-migration.mjs runner performs a read-only preflight by default and applies only this migration with --apply and an environment-supplied DATABASE_URL. No credentials are stored in the script.

Run node --test scripts/test-payroll.mjs, ESLint on payroll files, and npm run build. Live upload testing requires the actual payroll folder and app Drive permissions. No teacher payslip is published by deployment itself.
