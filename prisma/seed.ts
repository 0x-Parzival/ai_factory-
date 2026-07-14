/**
 * Intentionally empty: production environments must start without fabricated
 * users, organizations, personas, or activity. Create real records through
 * the application or approved provisioning flow instead.
 */
async function main() {
  console.log("No records were seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
