import Link from "next/link";
import { Bot, Users, Workflow, Store, Settings, BarChart3, MessageSquare } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: BarChart3, label: "Overview" },
  { href: "/dashboard/agents", icon: Bot, label: "Agents" },
  { href: "/dashboard/personas", icon: Users, label: "Persona Studio" },
  { href: "/dashboard/workflows", icon: Workflow, label: "Workflows" },
  { href: "/dashboard/conversations", icon: MessageSquare, label: "Conversations" },
  { href: "/dashboard/marketplace", icon: Store, label: "Marketplace" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">AI Factory</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-sm"
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            AI Factory v0.1
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
