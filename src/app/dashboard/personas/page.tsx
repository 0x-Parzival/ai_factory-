"use client";

import { useState } from "react";
import { Search, Filter, Star, Download, ExternalLink, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "All", "Engineering", "Design", "Marketing", "Sales", "Product",
  "Strategy", "Support", "Testing", "Data", "Infrastructure", "Game Dev", "Academic",
];

// Sample data (will be replaced with real data from agency-agents import)
const SAMPLE_PERSONAS = [
  {
    id: "1",
    name: "Frontend Developer",
    category: "Engineering",
    description: "React/Vue/Angular specialist. Performance optimization, pixel-perfect UIs, Core Web Vitals.",
    personality: "Detail-oriented, pragmatic, loves clean code",
    rating: 4.8,
    installs: 234,
    model: "claude-sonnet",
    tags: ["React", "Vue", "Performance", "UI"],
  },
  {
    id: "2",
    name: "Backend Architect",
    category: "Engineering",
    description: "API design, database architecture, scalability. Expert in distributed systems.",
    personality: "Systematic, thinks in patterns, reliability-focused",
    rating: 4.9,
    installs: 189,
    model: "claude-sonnet",
    tags: ["API", "Database", "Microservices", "Cloud"],
  },
  {
    id: "3",
    name: "AI Engineer",
    category: "Engineering",
    description: "ML model deployment, production AI integration, data pipelines.",
    personality: "Research-driven, experimental, math-minded",
    rating: 4.7,
    installs: 156,
    model: "claude-opus",
    tags: ["ML", "TensorFlow", "PyTorch", "MLOps"],
  },
  {
    id: "4",
    name: "DevOps Automator",
    category: "Engineering",
    description: "CI/CD, infrastructure automation, cloud operations. Kubernetes expert.",
    personality: "Efficiency-obsessed, automation-first, calm under pressure",
    rating: 4.8,
    installs: 198,
    model: "claude-sonnet",
    tags: ["CI/CD", "Kubernetes", "Terraform", "AWS"],
  },
  {
    id: "5",
    name: "UI/UX Designer",
    category: "Design",
    description: "User interface design, design systems, accessibility, prototyping.",
    personality: "Empathetic, aesthetic-driven, user advocate",
    rating: 4.9,
    installs: 312,
    model: "claude-sonnet",
    tags: ["Figma", "Design Systems", "Accessibility", "Prototyping"],
  },
  {
    id: "6",
    name: "Growth Marketer",
    category: "Marketing",
    description: "Growth hacking, SEO, content marketing, analytics-driven campaigns.",
    personality: "Data-informed creative, growth-obsessed, experimenter",
    rating: 4.6,
    installs: 145,
    model: "claude-sonnet",
    tags: ["SEO", "Content", "Analytics", "Growth"],
  },
  {
    id: "7",
    name: "Data Engineer",
    category: "Data",
    description: "Data pipelines, ETL, warehousing, real-time analytics infrastructure.",
    personality: "Pipeline thinker, quality-focused, optimization-minded",
    rating: 4.7,
    installs: 134,
    model: "claude-sonnet",
    tags: ["Spark", "Airflow", "SQL", "Data Warehousing"],
  },
  {
    id: "8",
    name: "Security Engineer",
    category: "Engineering",
    description: "Application security, penetration testing, code review, compliance.",
    personality: "Paranoid (in a good way), thorough, adversarial thinker",
    rating: 4.9,
    installs: 201,
    model: "claude-opus",
    tags: ["Security", "Penetration Testing", "OWASP", "Compliance"],
  },
];

export default function PersonaStudioPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = SAMPLE_PERSONAS.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "All" || p.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Persona Studio</h1>
          <p className="text-slate-400 mt-1">Browse and deploy specialist AI agents</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition">
          <Plus className="w-4 h-4" />
          Create Persona
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                category === cat
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-400 mb-4">
        {filtered.length} agent{filtered.length !== 1 ? "s" : ""} found
      </div>

      {/* Persona Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((persona) => (
          <div
            key={persona.id}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/30 transition group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold group-hover:text-violet-300 transition">
                  {persona.name}
                </h3>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {persona.category}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-yellow-400 text-sm">
                <Star className="w-3.5 h-3.5 fill-current" />
                {persona.rating}
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-3 line-clamp-2">
              {persona.description}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {persona.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  {persona.installs}
                </span>
                <span>{persona.model}</span>
              </div>
              <a
                href={`/dashboard/personas/${persona.id}`}
                className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition"
              >
                Deploy
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
