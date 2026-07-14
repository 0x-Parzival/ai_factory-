import { auth, currentUser } from "@clerk/nextjs/server";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { isClerkConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authConfigured = isClerkConfigured();
  let displayUser: { name: string; email: string } | undefined;
  if (authConfigured) {
    await auth.protect();
    const user = await currentUser();
    if (user) {
      displayUser = {
        name: user.fullName || user.firstName || "Factory user",
        email: user.primaryEmailAddress?.emailAddress || "Authenticated account",
      };
    }
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-64">
        <Header user={displayUser} authConfigured={authConfigured} />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
