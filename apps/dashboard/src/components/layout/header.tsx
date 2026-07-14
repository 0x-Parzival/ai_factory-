"use client";

import * as React from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, BrainCircuit, BriefcaseBusiness, Cable, KeyRound, Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mobileNavigation = [
  { name: "Overview", href: "/dashboard", icon: Bot, exact: true },
  { name: "Agent Activity", href: "/dashboard/agents", icon: Activity },
  { name: "Departments", href: "/dashboard/departments", icon: BriefcaseBusiness },
  { name: "Providers", href: "/dashboard/providers", icon: BrainCircuit },
  { name: "Connectors", href: "/dashboard/connectors", icon: Cable },
  { name: "Governance", href: "/dashboard/governance", icon: ShieldCheck },
];

export function Header({ user, authConfigured }: { user?: { name: string; email: string }; authConfigured: boolean }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Toggle navigation">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500"><Bot className="h-5 w-5 text-white" /></div>
            <div>
              <span className="block font-bold leading-tight">Spiritual AI Factory</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">Company control plane</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden font-normal text-muted-foreground sm:flex">{authConfigured ? "Authenticated" : "Configuration mode"}</Badge>
          {user && <div className="hidden text-right lg:block"><p className="text-xs font-medium leading-tight">{user.name}</p><p className="max-w-48 truncate text-[11px] text-muted-foreground">{user.email}</p></div>}
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          {authConfigured && <UserButton afterSignOutUrl="/sign-in" />}
          {!authConfigured && <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link href="/sign-in"><KeyRound className="mr-2 h-4 w-4" />Enable login</Link></Button>}
        </div>
      </div>
      {mobileMenuOpen && (
        <nav className="grid gap-1 border-t p-3 md:hidden" aria-label="Mobile navigation">
          {mobileNavigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                <item.icon className="h-4 w-4" />{item.name}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
