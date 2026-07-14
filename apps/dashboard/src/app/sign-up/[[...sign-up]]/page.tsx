import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { isClerkConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!isClerkConfigured()) redirect("/sign-in");
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/dashboard" /></main>;
}
