import { Bot, MessageSquare, Workflow, Users, TrendingUp, Clock } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 mt-1">Welcome back. Here&apos;s your AI team overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Agents", value: "0", icon: Bot, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Messages Today", value: "0", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Workflows Run", value: "0", icon: Workflow, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Team Members", value: "1", icon: Users, color: "text-orange-400", bg: "bg-orange-500/10" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-6 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20">
          <h3 className="font-semibold mb-2">Deploy Your First Agent</h3>
          <p className="text-sm text-slate-300 mb-4">
            Browse 800+ specialist personas and deploy one to your preferred channel in minutes.
          </p>
          <a
            href="/dashboard/personas"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
          >
            Browse Persona Studio
          </a>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20">
          <h3 className="font-semibold mb-2">Build a Workflow</h3>
          <p className="text-sm text-slate-300 mb-4">
            Create deterministic multi-step pipelines with approval gates and resumable execution.
          </p>
          <a
            href="/dashboard/workflows"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition"
          >
            Create Workflow
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Recent Activity
        </h3>
        <div className="text-center py-12 text-slate-500">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No activity yet. Deploy an agent to get started!</p>
        </div>
      </div>
    </div>
  );
}
