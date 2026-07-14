/**
 * Production-safe database initializer.
 *
 * Organizations, departments, agents and connector records are tenant-owned
 * operational data. They must be created through authenticated onboarding so
 * that ownership, credentials, approval limits and audit provenance are known.
 * This command intentionally inserts no tenant or operational records.
 */
async function main(): Promise<void> {
  console.info("Core seed completed: no records inserted.");
}

main().catch((error: unknown) => {
  console.error("Core seed failed", error);
  process.exitCode = 1;
});
