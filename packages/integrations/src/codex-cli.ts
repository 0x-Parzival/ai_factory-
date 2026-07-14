import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export interface CodexCliCompletionRequest {
  prompt: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CodexCliStatus {
  installed: boolean;
  authenticated: boolean;
  method?: "chatgpt" | "api-key" | "access-token" | "unknown";
  detail: string;
}

function command() {
  return process.env.CODEX_CLI_PATH?.trim() || "codex";
}

async function run(args: string[], stdin: string, timeoutMs: number, outerSignal?: AbortSignal) {
  return await new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Codex CLI timed out")), timeoutMs);
    const abort = () => controller.abort(outerSignal?.reason || new Error("Codex CLI request aborted"));
    outerSignal?.addEventListener("abort", abort, { once: true });
    const child = spawn(command(), args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      signal: controller.signal,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    const append = (target: "stdout" | "stderr", chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        controller.abort(new Error("Codex CLI output exceeded the safe limit"));
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", abort);
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(stderr.trim().slice(-1_000) || `Codex CLI exited with code ${code}`));
    });
    child.stdin.end(stdin);
  });
}

export async function getCodexCliStatus(): Promise<CodexCliStatus> {
  try {
    const result = await run(["login", "status"], "", 4_000);
    const detail = `${result.stdout}\n${result.stderr}`.trim();
    const lower = detail.toLowerCase();
    const authenticated = lower.includes("logged in") || lower.includes("authenticated");
    const method = lower.includes("chatgpt") ? "chatgpt" : lower.includes("api key") ? "api-key" : lower.includes("access token") ? "access-token" : "unknown";
    return { installed: true, authenticated, method, detail: authenticated ? `Codex signed in with ${method === "chatgpt" ? "ChatGPT" : method}` : "Codex is installed but not signed in" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Codex CLI is unavailable";
    const missing = /enoent|not found/i.test(message);
    return { installed: !missing, authenticated: false, detail: missing ? "Codex CLI is not installed" : "Codex CLI is not signed in" };
  }
}

export async function completeWithCodexCli(request: CodexCliCompletionRequest) {
  if (!request.prompt.trim()) throw new Error("Codex prompt is required");
  const workdir = resolve(process.env.CODEX_ADVISORY_WORKDIR || join(tmpdir(), "spiritual-ai-codex-advisory"));
  await mkdir(workdir, { recursive: true, mode: 0o700 });
  const args = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--sandbox", "read-only",
    "--skip-git-repo-check",
    "--color", "never",
    "--cd", workdir,
  ];
  if (request.model?.trim()) args.push("--model", request.model.trim());
  args.push("-");
  const result = await run(args, request.prompt, request.timeoutMs || 90_000, request.signal);
  const text = result.stdout.trim();
  if (!text) throw new Error("Codex CLI returned an empty response");
  return { text, provider: "codex" as const, model: request.model || "ChatGPT account default" };
}
