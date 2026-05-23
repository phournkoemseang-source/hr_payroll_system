import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { Database } from "../database/Database";

export abstract class BaseRepository {
  protected readonly db = Database.getInstance();

  protected query<T extends RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    return this.db.query<T>(sql, params);
  }

  protected execute(
    sql: string,
    params?: unknown[],
  ): Promise<ResultSetHeader> {
    return this.db.execute(sql, params);
  }

  protected async transaction<T>(
    callback: (connection: PoolConnection) => Promise<T>,
  ): Promise<T> {
    const connection = await this.db.getPool().getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}
