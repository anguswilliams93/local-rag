/**
 * Frontend logger that logs to console and sends to backend for file logging
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private minLevel: LogLevel = "info";
  private logs: LogEntry[] = [];
  private maxLocalLogs = 1000;

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, data);

    // Store locally
    this.logs.push(entry);
    if (this.logs.length > this.maxLocalLogs) {
      this.logs.shift();
    }

    // Console output with styling
    const styles: Record<LogLevel, string> = {
      debug: "color: gray",
      info: "color: blue",
      warn: "color: orange",
      error: "color: red; font-weight: bold",
    };

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;

    if (data !== undefined) {
      console.log(`%c${prefix} ${message}`, styles[level], data);
    } else {
      console.log(`%c${prefix} ${message}`, styles[level]);
    }

    // For errors, also send to backend logging endpoint if available
    if (level === "error") {
      this.sendToBackend(entry).catch(() => {
        // Silently fail if backend logging fails
      });
    }
  }

  private async sendToBackend(entry: LogEntry) {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${API_BASE_URL}/logs/frontend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    } catch {
      // Ignore errors when sending logs
    }
  }

  debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown) {
    this.log("error", message, data);
  }

  // Get recent logs for debugging
  getRecentLogs(count = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Export logs as downloadable file
  exportLogs(): string {
    return this.logs
      .map((entry) => {
        const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : "";
        return `${entry.timestamp} | ${entry.level.toUpperCase().padEnd(5)} | ${entry.message}${dataStr}`;
      })
      .join("\n");
  }

  // Download logs as file
  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frontend-logs-${new Date().toISOString().split("T")[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger();

// Make logger available globally for debugging
if (typeof window !== "undefined") {
  (window as unknown as { ragooLogger: Logger }).ragooLogger = logger;
}
