import { Settings, Key, Bell, CreditCard, Users } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {[
          { icon: Key, title: "API Keys", desc: "Configure LLM provider keys (Groq, Gemini, Ollama)" },
          { icon: Bell, title: "Notifications", desc: "Set up alerts for agent activity and approvals" },
          { icon: CreditCard, title: "Billing", desc: "Manage subscription and view usage" },
          { icon: Users, title: "Team", desc: "Invite team members and manage roles" },
        ].map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
