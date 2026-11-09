export const LAIBA_MIGRATION = '20261109160000_assign_laiba_girls_qabila';
// Both shipped revisions only repair data inside a transaction. They make no
// schema changes. The replacement migration is a no-op; data repair is explicit.
const DATA_REPAIR_CHECKSUMS = new Set([
  'c0772498f7e9fa1ac63dbd1d5bed30b5e163041f0cfe83f9945a93335d9b4c0e', // b2cf421
  '39ac78b3209a7e59062c4a596215397b9cf6bc5e21f7965a6e62102ee3ae3400', // 7879823
]);
export function canRecoverLaibaMigration(rows) {
  if (rows.length !== 1) return false;
  const row = rows[0];
  return row.migration_name === LAIBA_MIGRATION && DATA_REPAIR_CHECKSUMS.has(row.checksum)
    && !row.finished_at && !row.rolled_back_at;
}
