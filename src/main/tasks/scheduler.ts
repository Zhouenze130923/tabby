import { tasks, ScheduledTask } from "../storage/db";
import { tabManager } from "../browser/tab-manager";
import { BrowserWindow, ipcMain } from "electron";

/**
 * Simple cron expression parser (minute hour day * *)
 */
function matchesCron(cronExpr: string, now: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minute = now.getMinutes();
  const hour = now.getHours();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay(); // 0=Sun

  const cronFields = [
    { field: minute, cron: parts[0] },
    { field: hour, cron: parts[1] },
    { field: dayOfMonth, cron: parts[2] },
    { field: month, cron: parts[3] },
    { field: dayOfWeek, cron: parts[4] },
  ];

  return cronFields.every(({ field, cron }) => {
    if (cron === "*") return true;

    // Handle */N
    const stepMatch = cron.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1]);
      return field % step === 0;
    }

    // Handle comma-separated list: "5,10,15"
    const values = cron.split(",").map((v) => v.trim());
    return values.some((v) => {
      // Handle range: "8-17"
      const rangeMatch = v.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const lo = parseInt(rangeMatch[1]);
        const hi = parseInt(rangeMatch[2]);
        return field >= lo && field <= hi;
      }
      return parseInt(v) === field;
    });
  });
}

/**
 * TaskScheduler — runs in the main process.
 * Periodically checks for due tasks and executes them.
 */
export class TaskScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private executing = false;
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  start(): void {
    if (this.timer) return;
    console.log("[TaskScheduler] Starting — checking every 15 seconds");
    // Check every 15 seconds
    this.timer = setInterval(() => this.check(), 15000);
    // Also run an immediate check
    this.check();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[TaskScheduler] Stopped");
    }
  }

  private async check(): Promise<void> {
    if (this.executing) return; // Don't overlap
    this.executing = true;

    try {
      const all = tasks.all();
      const now = new Date();
      const due: ScheduledTask[] = [];

      for (const task of all) {
        if (!task.active) continue;

        switch (task.type) {
          case "interval": {
            if (!task.interval_ms) break;
            const lastRun = task.last_run ? new Date(task.last_run).getTime() : 0;
            if (now.getTime() - lastRun >= task.interval_ms) {
              due.push(task);
            }
            break;
          }
          case "cron": {
            if (!task.cron_expr) break;
            if (matchesCron(task.cron_expr, now)) {
              // Only run once per cron tick — check last run was > 1 minute ago
              const lastRun = task.last_run ? new Date(task.last_run).getTime() : 0;
              if (now.getTime() - lastRun > 60000) {
                due.push(task);
              }
            }
            break;
          }
          case "once": {
            // Once tasks haven't run yet
            if (!task.last_run) {
              due.push(task);
            }
            break;
          }
        }
      }

      for (const task of due) {
        await this.executeTask(task);
      }
    } catch (err) {
      console.error("[TaskScheduler] Check error:", err);
    } finally {
      this.executing = false;
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    console.log(`[TaskScheduler] Executing task: ${task.name} (${task.id})`);

    try {
      // 1. Navigate to target URL if specified
      if (task.tab_url && this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Navigate active tab or create new one
        const activeId = tabManager.getActiveId();
        if (activeId) {
          tabManager.navigate(activeId, task.tab_url);
          // Brief wait for navigation to start
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          tabManager.create(task.tab_url);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // 2. Execute the prompt via AI — send message to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send("tasks:execute", {
          id: task.id,
          name: task.name,
          prompt: task.prompt,
        });
      }

      // 3. For "once" tasks, deactivate after execution
      if (task.type === "once") {
        tasks.update(task.id, { active: false, last_run: new Date().toISOString() });
      } else {
        tasks.update(task.id, { last_run: new Date().toISOString() });
      }
    } catch (err) {
      console.error(`[TaskScheduler] Failed to execute task ${task.name}:`, err);
    }
  }
}

/** Singleton instance */
export const taskScheduler = new TaskScheduler();
