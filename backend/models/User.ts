import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2";
import { Database } from "../config/Database";
import { IUser, IUserPublic } from "../types";

export class UserModel {
  private readonly db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    const rows = await this.db.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email],
    );
    return rows.length > 0 ? (rows[0] as IUser) : null;
  }

  public async findById(id: number): Promise<IUser | null> {
    const rows = await this.db.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? (rows[0] as IUser) : null;
  }

  public async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  public toPublicUser(user: IUser): IUserPublic {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
