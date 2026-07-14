/**
 * Persona Import Script
 * 
 * Reads all .md files from the agency-agents directory and converts them
 * to Prisma seed format. Each agent file contains:
 * - Frontmatter with name, description, personality
 * - System prompt sections
 * - Tool recommendations
 * 
 * Usage: npx tsx prisma/seed-personas.ts
 */

import fs from "fs";
import path from "path";

const AGENCY_AGENTS_DIR = path.resolve(__dirname, "../../AI factory/agency-agents");

interface RawPersona {
  name: string;
  category: string;
  description: string;
  personality: string;
  systemPrompt: string;
  tools: string[];
  model: string;
}

function parseAgentFile(content: string, filename: string): RawPersona | null {
  const lines = content.split("\n");
  
  // Extract name from first heading or filename
  let name = filename.replace(/-/g, " ").replace(".md", "");
  let description = "";
  let personality = "";
  let systemPrompt = content;
  const tools: string[] = [];
  let category = "SPECIALIZED";
  
  // Parse frontmatter-like structure
  for (const line of lines) {
    if (line.startsWith("# ")) {
      name = line.slice(2).trim();
    } else if (line.toLowerCase().includes("description") || line.toLowerCase().includes("when to use")) {
      description = line.replace(/^[^:]*:\s*/, "").trim();
    }
  }
  
  // Detect category from content/patterns
  const contentLower = content.toLowerCase();
  if (contentLower.includes("react") || contentLower.includes("frontend") || contentLower.includes("css")) {
    category = "ENGINEERING";
  } else if (contentLower.includes("api") || contentLower.includes("backend") || contentLower.includes("database")) {
    category = "ENGINEERING";
  } else if (contentLower.includes("marketing") || contentLower.includes("seo") || contentLower.includes("content")) {
    category = "MARKETING";
  } else if (contentLower.includes("design") || contentLower.includes("ui") || contentLower.includes("ux")) {
    category = "DESIGN";
  } else if (contentLower.includes("sales") || contentLower.includes("prospecting")) {
    category = "SALES";
  } else if (contentLower.includes("data") || contentLower.includes("analytics") || contentLower.includes("sql")) {
    category = "DATA";
  } else if (contentLower.includes("security") || contentLower.includes("penetration")) {
    category = "ENGINEERING";
  } else if (contentLower.includes("devops") || contentLower.includes("ci/cd") || contentLower.includes("kubernetes")) {
    category = "INFRASTRUCTURE";
  } else if (contentLower.includes("game") || contentLower.includes("unity") || contentLower.includes("unreal")) {
    category = "GAME_DEVELOPMENT";
  } else if (contentLower.includes("test") || contentLower.includes("qa")) {
    category = "TESTING";
  } else if (contentLower.includes("strategy") || contentLower.includes("business")) {
    category = "STRATEGY";
  }
  
  // Detect model preference
  let model = "claude-sonnet-4-20250514";
  if (contentLower.includes("complex") || contentLower.includes("architecture") || contentLower.includes("reasoning")) {
    model = "claude-opus-4-20250514";
  }
  
  // Extract tools from content
  const toolPatterns = ["GitHub", "Slack", "Jira", "Figma", "AWS", "Docker", "Kubernetes", "PostgreSQL", "Redis"];
  for (const tool of toolPatterns) {
    if (contentLower.includes(tool.toLowerCase())) {
      tools.push(tool);
    }
  }
  
  return {
    name,
    category,
    description: description || `${name} specialist agent`,
    personality: personality || "Professional, detail-oriented, expert in their domain",
    systemPrompt,
    tools,
    model,
  };
}

function scanDir(dir: string): RawPersona[] {
  const personas: RawPersona[] = [];
  
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      personas.push(...scanDir(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".md") && entry.name !== "README.md" && entry.name !== "CONTRIBUTING.md" && entry.name !== "LICENSE") {
      const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
      const persona = parseAgentFile(content, entry.name);
      if (persona) personas.push(persona);
    }
  }
  
  return personas;
}

export function getAllPersonas(): RawPersona[] {
  return scanDir(AGENCY_AGENTS_DIR);
}

// Allow running directly
if (require.main === module) {
  const personas = getAllPersonas();
  console.log(`Found ${personas.length} personas`);
  
  // Output as JSON for inspection
  const output = JSON.stringify(personas.slice(0, 3), null, 2);
  console.log(output);
}
