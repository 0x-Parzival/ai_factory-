import Link from "next/link";
import { Bot, Zap, Users, Workflow, Globe, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">AI Factory</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <Link href="#features" className="hover:text-white transition">Features</Link>
            <Link href="#personas" className="hover:text-white transition">Personas</Link>
            <Link href="#workflows" className="hover:text-white transition">Workflows</Link>
            <Link href="#pricing" className="hover:text-white transition">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
            <Zap className="w-4 h-4" />
            <span>800+ AI Agents Ready to Deploy</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
            Deploy Your Dream AI Team
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Browse specialist agents, connect any channel, build workflows, and manage your AI workforce — all from one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-semibold text-lg transition shadow-lg shadow-violet-500/25"
            >
              Get Started Free
            </Link>
            <Link
              href="#personas"
              className="px-8 py-3 rounded-xl border border-slate-600 hover:border-slate-500 font-semibold text-lg transition"
            >
              Browse Agents
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Persona Studio",
                desc: "800+ specialist AI agents across engineering, marketing, design, and more. Or create your own with custom personality and expertise.",
              },
              {
                icon: Globe,
                title: "Multi-Channel",
                desc: "Deploy to Telegram, Discord, WhatsApp, Slack, or WebChat. One agent, every channel, simultaneously.",
              },
              {
                icon: Workflow,
                title: "Workflow Engine",
                desc: "Build deterministic multi-step pipelines with approval gates. No LLM re-planning, no surprises.",
              },
              {
                icon: Shield,
                title: "Team Governance",
                desc: "Organizations, boards, tasks, approvals, and full audit trails. Built for teams that need control.",
              },
              {
                icon: Bot,
                title: "Agent Marketplace",
                desc: "Browse, install, and rate agents. Create your own and earn revenue when others deploy it.",
              },
              {
                icon: Zap,
                title: "Cross-Session Memory",
                desc: "Agents remember users across conversations. Continuity, context, and genuine relationship building.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/30 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Persona Categories */}
      <section id="personas" className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">800+ Specialist Agents</h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Every persona is a unique expert with personality, communication style, and domain expertise.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Engineering", count: "20+", emoji: "💻", color: "from-blue-500/20 to-cyan-500/20" },
              { name: "Design", count: "12+", emoji: "🎨", color: "from-pink-500/20 to-rose-500/20" },
              { name: "Marketing", count: "15+", emoji: "📈", color: "from-green-500/20 to-emerald-500/20" },
              { name: "Data", count: "14+", emoji: "📊", color: "from-orange-500/20 to-amber-500/20" },
              { name: "Sales", count: "10+", emoji: "💼", color: "from-violet-500/20 to-purple-500/20" },
              { name: "Infrastructure", count: "11+", emoji: "⚡", color: "from-yellow-500/20 to-orange-500/20" },
              { name: "Game Dev", count: "8+", emoji: "🎮", color: "from-indigo-500/20 to-blue-500/20" },
              { name: "Strategy", count: "9+", emoji: "🎯", color: "from-teal-500/20 to-cyan-500/20" },
            ].map((cat) => (
              <Link
                key={cat.name}
                href={`/marketplace?category=${cat.name.toLowerCase()}`}
                className={`p-5 rounded-xl bg-gradient-to-br ${cat.color} border border-slate-700/50 hover:border-violet-500/30 transition group`}
              >
                <div className="text-2xl mb-2">{cat.emoji}</div>
                <div className="font-semibold group-hover:text-violet-300 transition">{cat.name}</div>
                <div className="text-sm text-slate-400">{cat.count} agents</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                tier: "Free",
                price: "$0",
                period: "/month",
                features: ["3 agents", "1 channel", "100 messages/day", "Community support"],
                cta: "Start Free",
                highlight: false,
              },
              {
                tier: "Pro",
                price: "$29",
                period: "/month",
                features: ["20 agents", "3 channels", "5K messages/day", "Workflows", "Priority support"],
                cta: "Get Pro",
                highlight: true,
              },
              {
                tier: "Team",
                price: "$99",
                period: "/month",
                features: ["Unlimited agents", "All channels", "Mission Control", "Approval flows", "Audit logs"],
                cta: "Get Team",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`p-6 rounded-2xl border ${
                  plan.highlight
                    ? "border-violet-500 bg-violet-500/5"
                    : "border-slate-700/50 bg-slate-800/30"
                }`}
              >
                <div className="text-sm font-medium text-violet-400 mb-1">{plan.tier}</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-slate-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`block text-center py-2.5 rounded-lg font-medium transition ${
                    plan.highlight
                      ? "bg-violet-600 hover:bg-violet-500"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">AI Factory</span>
          </div>
          <div className="text-sm text-slate-500">
            © 2025 AI Factory. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
