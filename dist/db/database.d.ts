import Database from 'better-sqlite3';
export declare class GrokDatabase {
    private db;
    private static instance;
    private constructor();
    static getInstance(): GrokDatabase;
    private initialize;
    getDb(): Database.Database;
    close(): void;
}
export declare const db: GrokDatabase;
