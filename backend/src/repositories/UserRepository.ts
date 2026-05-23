import { RowDataPacket } from "mysql2";
import { CreateUserRequest } from "../models/Auth";
import { PublicUser, UserRecord } from "../models/User";
import { SchemaRepository } from "./SchemaRepository";

export class UserRepository extends SchemaRepository {
  public async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  public async findById(id: number): Promise<UserRecord | null> {
    const rows = await this.query<RowDataPacket[]>(
      "SELECT id, name, email, password, role, created_at FROM users WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  public async create(data: CreateUserRequest): Promise<PublicUser> {
    await this.ensureEmployeeProfileSchema();

    const result = await this.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [data.name, data.email, data.password, data.role],
    );

    await this.createEmployeeProfile(result.insertId, data);

    return {
      id: result.insertId,
      name: data.name,
      email: data.email,
      role: data.role,
    };
  }

  private async createEmployeeProfile(
    userId: number,
    data: CreateUserRequest,
  ): Promise<void> {
    await this.execute(
      `
        INSERT INTO employee_profiles
          (user_id, department, position, start_date, base_salary)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        userId,
        data.department?.trim() || (data.role === "admin" ? "HR" : "Operations"),
        data.position?.trim() || (data.role === "admin" ? "Administrator" : "Staff"),
        data.startDate || null,
        this.normalizeSalary(data.salary),
      ],
    );
  }

  private normalizeSalary(value: string | number | undefined): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (!value) {
      return 0;
    }

    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
