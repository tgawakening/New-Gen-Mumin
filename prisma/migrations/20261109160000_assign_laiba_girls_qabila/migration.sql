-- The owner-requested Laiba assignment is an operational data repair.
-- Keep its migration-history slot, but do not block web startup on a family record.
-- Run `node scripts/assign-laiba-qabila.mjs --apply` separately after deployment.
-- Existing assignments and all application data are preserved.
SELECT 1;
