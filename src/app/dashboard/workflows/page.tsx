import { Workflow, Plus, Play, Clock, CheckCircle2 } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-slate-400 mt-1">Deterministic multi-step pipelines with approval gates</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition">
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      {/* Empty state */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-12 text-center">
        <Workflow className="w-16 h-16 mx-auto mb-4 text-slate-700" />
        <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Build deterministic workflows with approval gates. Define steps, assign agents, and let the pipeline run reliably.
        </p>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition">
          Create Your First Workflow
        </button>
      </div>
    </div>
  );
}
