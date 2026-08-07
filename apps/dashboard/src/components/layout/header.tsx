"use client";

import * as React from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, BrainCircuit, BriefcaseBusiness, Cable, ChevronDown, KeyRound, Menu, Moon, Plus, ShieldCheck, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const mobileNavigation = [
  { name: "Overview", href: "/dashboard", icon: Bot, exact: true },
  { name: "Departments", href: "/dashboard/departments", icon: BriefcaseBusiness },
  { name: "Agent activity", href: "/dashboard/agents", icon: Activity },
  { name: "Providers", href: "/dashboard/providers", icon: BrainCircuit },
  { name: "Connectors", href: "/dashboard/connectors", icon: Cable },
  { name: "Security", href: "/dashboard/departments/cyber-security", icon: ShieldCheck },
];

export function Header({ user, authConfigured }: { user?: { name: string; email: string }; authConfigured: boolean }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [businesses, setBusinesses] = React.useState(["Spiritual AI Factory"]);
  const [activeBusiness, setActiveBusiness] = React.useState("Spiritual AI Factory");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("ai-factory-businesses");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((name: unknown): name is string => typeof name === "string" && name.trim().length > 0)) {
        setBusinesses(parsed);
        const selected = window.localStorage.getItem("ai-factory-active-business");
        setActiveBusiness(selected && parsed.includes(selected) ? selected : parsed[0] || "Spiritual AI Factory");
      }
    } catch { /* Ignore invalid local storage. */ }
  }, []);

  function addBusiness() {
    const name = window.prompt("Business name?")?.trim();
    if (!name || businesses.includes(name)) return;
    const next = [...businesses, name];
    setBusinesses(next);
    setActiveBusiness(name);
    window.localStorage.setItem("ai-factory-businesses", JSON.stringify(next));
    window.localStorage.setItem("ai-factory-active-business", name);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Toggle navigation">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500"><Bot className="h-5 w-5 text-white" /></div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto max-w-52 justify-start px-1.5 py-1 text-left" aria-label={`Select business, currently ${activeBusiness}`}>
                <span className="min-w-0"><span className="block truncate font-bold leading-tight">{activeBusiness}</span><span className="hidden text-[11px] text-muted-foreground sm:block">Company control plane</span></span><ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Businesses</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeBusiness} onValueChange={(name) => { setActiveBusiness(name); window.localStorage.setItem("ai-factory-active-business", name); }}>
                {businesses.map((business) => <DropdownMenuRadioItem key={business} value={business}>{business}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={addBusiness}><Plus className="mr-2 h-4 w-4" />Add business</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
