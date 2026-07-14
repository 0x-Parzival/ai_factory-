import { MessageSquare, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ConversationsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-slate-400 mt-1">View and manage all chat conversations</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search conversations..."
            className="pl-10 bg-slate-900 border-slate-700"
          />
        </div>
      </div>

      {/* Empty state */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-700" />
        <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Once you deploy an agent and users start chatting, all conversations will appear here.
        </p>
      </div>
    </div>
  );
}
