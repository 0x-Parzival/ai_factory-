import { Store, Search, Star, Download, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function MarketplacePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-slate-400 mt-1">Discover and install AI agents from the community</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search marketplace..."
            className="pl-10 bg-slate-900 border-slate-700"
          />
        </div>
      </div>

      {/* Featured section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-400" />
          Trending
        </h2>
        <div className="rounded-xl bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 border border-violet-500/20 p-8 text-center">
          <Store className="w-12 h-12 mx-auto mb-3 text-violet-400" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            The marketplace is being populated with 800+ agents from the Agency Agents collection. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
