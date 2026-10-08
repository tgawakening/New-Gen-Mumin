# Qabila reward audit

Open **Admin ? Rewards ? Complete history** (`/admin/rewards/history`). The history page is read-only and queries all matching database records, with 30 entries per page and first/previous/next/last plus direct page navigation.

- **Points ledger:** positive awards, negative adjustments/reversals, zero entries, source type, reason, learner, PKT timestamp, original house and source/transaction references. The net total and source breakdown cover every filtered page.
- **Badges & recognition:** both active and revoked student awards, bonus amount, issuer, revoker, featured week, evidence and source references.
- **Team reward unlocks:** original house, milestone, created/unlocked/delivered timestamps and recorded delivery status. Date filters use creation date for this tab.
- **Current members:** current Qabila assignments and account status, including inactive accounts whose historical points are retained.

Current-member point grouping matches the existing admin dashboard: all of a learner's points follow their current Qabila. Recorded-house grouping instead uses the house saved on each point transaction. Recognition uses current membership because it has no original-house field; team rewards use their saved house. Historical Qabila transfers were not separately audited and cannot be reconstructed reliably from current membership alone. Deleted records cannot be recovered by this page.

No dates means all stored history. Date ranges use inclusive Pakistan calendar dates. Invalid ranges return no results with a validation message. Each record's original IDs remain visible for investigating duplicate-looking entries or corrections.

The admin role is checked before any audit queries. No database migration is needed.
