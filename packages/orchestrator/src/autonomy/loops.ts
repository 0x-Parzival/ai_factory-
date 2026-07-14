import type { Clock, DepartmentId, NewDepartmentTask } from './types';

export interface DepartmentLoopContext {
  organizationId: string;
  departmentId: DepartmentId;
  now: Date;
  signal: AbortSignal;
}

/** Loop producers only propose internal tasks. They must not perform provider or
 * external side effects; execution happens later through the guarded runtime. */
export interface DepartmentLoopProducer {
  readonly departmentId: DepartmentId;
  propose(context: DepartmentLoopContext): Promise<readonly NewDepartmentTask[]>;
}

export interface RecurringLoopConfig {
  organizationId: string;
  intervalMs: number;
  initialDelayMs?: number;
  jitterRatio?: number;
}

export interface RecurringLoopHooks {
  run(producer: DepartmentLoopProducer, organizationId: string, signal: AbortSignal): Promise<void>;
  onError(producer: DepartmentLoopProducer, organizationId: string, error: unknown): Promise<void>;
}

export class RecurringDepartmentLoop {
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private running = false;

  constructor(
    private readonly producer: DepartmentLoopProducer,
    private readonly config: RecurringLoopConfig,
    private readonly hooks: RecurringLoopHooks,
    private readonly clock: Clock,
  ) {
    if (!Number.isFinite(config.intervalMs) || config.intervalMs < 1_000) {
      throw new Error('Recurring loop interval must be at least 1000ms');
    }
  }

  start(): void {
    if (this.controller) return;
    this.controller = new AbortController();
    this.schedule(this.config.initialDelayMs ?? 0);
  }

  stop(): void {
    this.controller?.abort();
    this.controller = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  isRunning(): boolean { return this.running; }

  async runOnce(signal: AbortSignal = new AbortController().signal): Promise<void> {
    if (this.running || signal.aborted) return;
    this.running = true;
    try {
      await this.hooks.run(this.producer, this.config.organizationId, signal);
    } catch (error) {
      await this.hooks.onError(this.producer, this.config.organizationId, error);
    } finally {
      this.running = false;
    }
  }

  private schedule(delay: number): void {
    const controller = this.controller;
    if (!controller) return;
    this.timer = setTimeout(async () => {
      await this.runOnce(controller.signal);
      if (!controller.signal.aborted) this.schedule(this.nextDelay());
    }, delay);
  }

  private nextDelay(): number {
    const jitter = Math.max(0, Math.min(0.5, this.config.jitterRatio ?? 0.1));
    const factor = 1 + (Math.random() * 2 - 1) * jitter;
    return Math.round(this.config.intervalMs * factor);
  }
}
