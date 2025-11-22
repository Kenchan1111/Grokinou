import fs from 'fs';
import path from 'path';
/**
 * Simple file logger for debugging (bypasses Ink stdout capture)
 */
class DebugLogger {
    logPath;
    enabled = true;
    constructor() {
        // Log to ~/.grok/debug.log
        const logDir = path.join(process.env.HOME || '~', '.grok');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logPath = path.join(logDir, 'debug.log');
        // Clear log on startup
        try {
            fs.writeFileSync(this.logPath, `=== DEBUG LOG - ${new Date().toISOString()} ===\n\n`);
        }
        catch (error) {
            this.enabled = false;
        }
    }
    log(...args) {
        if (!this.enabled)
            return;
        try {
            const timestamp = new Date().toISOString();
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
            fs.appendFileSync(this.logPath, `[${timestamp}] ${message}\n`);
        }
        catch (error) {
            // Silently fail
        }
    }
    error(...args) {
        this.log('ERROR:', ...args);
    }
    getLogPath() {
        return this.logPath;
    }
}
export const debugLog = new DebugLogger();
//# sourceMappingURL=debug-logger.js.map