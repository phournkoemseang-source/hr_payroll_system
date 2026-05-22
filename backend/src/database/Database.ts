import mysql, { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { envConfig } from "../config/env";

export class Database {
  private static instance: Database;
  private readonly pool: Pool;

  private constructor() {
    this.pool = mysql.createPool({
      ...envConfig.db,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query<T extends RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  public async execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return result;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
