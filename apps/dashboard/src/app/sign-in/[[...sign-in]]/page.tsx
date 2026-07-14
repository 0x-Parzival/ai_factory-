import { SignIn } from "@clerk/nextjs";
import { KeyRound } from "lucide-react";

import { isClerkConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (isClerkConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="space-y-4 text-center">
          <div><p className="text-sm font-medium text-violet-400">Spiritual AI Factory</p><h1 className="mt-1 text-2xl font-semibold">Owner control plane</h1><p className="mt-1 text-sm text-muted-foreground">One secure login for the CEO, providers, and connected company accounts.</p></div>
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-7 shadow-xl">
        <div className="mb-5 flex items-center gap-3"><KeyRound className="h-7 w-7 text-violet-500" /><div><h1 className="text-xl font-semibold">Configure secure login</h1><p className="text-sm text-muted-foreground">No demo or default account is installed</p></div></div>
        <p className="text-sm leading-relaxed text-muted-foreground">Create a Clerk application, enable your preferred sign-in methods, and set <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code className="rounded bg-muted px-1 py-0.5">CLERK_SECRET_KEY</code>. Restart the dashboard afterward.</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Until those keys exist, the dashboard is viewable in configuration mode, but every AI and model API is disabled.</p>
      </section>
    </main>
  );
}
