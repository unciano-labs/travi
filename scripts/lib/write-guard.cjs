// Refuse to run a script that writes to the database unless the operator names the target project.
// There is one shared Supabase project today (docs/MVP_LAUNCH_READINESS.md OPS-03), so a casual
// `npx tsx scripts/...` could corrupt real data. Usage: CONFIRM_DB_WRITE=<project-ref> npx tsx scripts/x.ts
function assertWriteTarget(scriptName) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  const ref = match ? match[1] : null;
  if (!ref) {
    console.error(`[${scriptName}] NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL. Aborting.`);
    process.exit(1);
  }
  if (process.env.CONFIRM_DB_WRITE !== ref) {
    console.error(
      `[${scriptName}] This script WRITES to Supabase project "${ref}".\n` +
        `Re-run with CONFIRM_DB_WRITE=${ref} if you are sure. Never run it against production.`
    );
    process.exit(1);
  }
}

module.exports = { assertWriteTarget };
