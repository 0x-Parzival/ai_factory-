import { FactoryOverview } from "@/components/factory-overview";
import { getRevenueSnapshot } from "@/lib/revenue";
import { getWorkerRuntimeStatus } from "@/lib/factory-runtime";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [revenue, worker] = await Promise.all([getRevenueSnapshot(), getWorkerRuntimeStatus()]);
  return <FactoryOverview revenue={revenue} worker={worker} />;
}
