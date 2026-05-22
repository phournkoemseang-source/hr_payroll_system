import { RowDataPacket } from "mysql2";
import { Database } from "../database/Database";
import { CreateUserRequest } from "../models/Auth";
import { PublicUser, UserRecord } from "../models/User";

export class UserRepository {
  private readonly db = Database.getInstance();

  public async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  public async findById(id: number): Promise<UserRecord | null> {
    const rows = await this.db.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  public async create(data: CreateUserRequest): Promise<PublicUser> {
    const result = await this.db.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [data.name, data.email, data.password, data.role],
    );

    return {
      id: result.insertId,
      name: data.name,
      email: data.email,
      role: data.role,
    };
  }
}
