"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Activity,
  BrainCircuit,
  BriefcaseBusiness,
  CircleDollarSign,
  Cable,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Workflow,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const controlNavigation = [
  { name: "CEO Overview", href: "/dashboard", icon: BarChart3, exact: true },
  { name: "Agent Activity", href: "/dashboard/agents", icon: Activity },
  { name: "Departments", href: "/dashboard/departments", icon: BriefcaseBusiness },
  { name: "AI Providers", href: "/dashboard/providers", icon: BrainCircuit },
  { name: "Business Connectors", href: "/dashboard/connectors", icon: Cable },
  { name: "Governance", href: "/dashboard/governance", icon: ShieldCheck },
  { name: "Budget", href: "/dashboard/budget", icon: CircleDollarSign },
];

const workspaceNavigation = [
  { name: "Agent Personas", href: "/dashboard/personas", icon: Sparkles },
  { name: "Workflows", href: "/dashboard/workflows", icon: Workflow },
  { name: "Care Inbox", href: "/dashboard/conversations", icon: MessageSquareText },
  { name: "Capabilities", href: "/dashboard/marketplace", icon: Store },
];

function NavLink({ item }: { item: { name: string; href: string; icon: typeof BarChart3; exact?: boolean } }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.name}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-16 left-0 z-30 hidden w-64 border-r bg-sidebar md:block" aria-label="Factory navigation">
      <nav className="flex h-full flex-col overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Control plane</p>
        <div className="space-y-1">{controlNavigation.map((item) => <NavLink key={item.href} item={item} />)}</div>
        <Separator className="my-4" />
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspaces</p>
        <div className="space-y-1">{workspaceNavigation.map((item) => <NavLink key={item.href} item={item} />)}</div>
        <div className="mt-auto pt-4">
          <Separator className="mb-3" />
          <NavLink item={{ name: "Settings", href: "/dashboard/settings", icon: Settings }} />
        </div>
      </nav>
    </aside>
  );
}
