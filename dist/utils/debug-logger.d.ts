/**
 * Simple file logger for debugging (bypasses Ink stdout capture)
 */
declare class DebugLogger {
    private logPath;
    private enabled;
    constructor();
    log(...args: any[]): void;
    error(...args: any[]): void;
    getLogPath(): string;
}
export declare const debugLog: DebugLogger;
export {};
