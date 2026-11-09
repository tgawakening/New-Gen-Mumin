export const LAIBA_MIGRATION = '20261109160000_assign_laiba_girls_qabila';
// Exact SQL shipped in b2cf421. Its DML is transactional, and the repaired SQL
// is repeat-safe. Never resolve an unrelated failure or an unknown script.
const ORIGINAL_CHECKSUM = 'c0772498f7e9fa1ac63dbd1d5bed30b5e163041f0cfe83f9945a93335d9b4c0e';
export function canRecoverLaibaMigration(rows) {
  if (rows.length !== 1) return false;
  const row = rows[0];
  // Prisma 6 can leave logs NULL after this failure. The exact checksum still
  // proves this is the transactional, repeat-safe script shipped in b2cf421.
  const knownFailure = !row.logs || (/1267/.test(row.logs) && /Illegal mix of collations/i.test(row.logs) && /query number (?:13|14)\b/i.test(row.logs));
  return row.migration_name === LAIBA_MIGRATION && row.checksum === ORIGINAL_CHECKSUM
    && !row.finished_at && !row.rolled_back_at
    && knownFailure;
}
