import { RowDataPacket } from "mysql2";
import {
  CreateEmployeeRequest,
  Employee,
  EmployeeStatus,
  UpdateEmployeeRequest,
} from "../models/Employee";
import { SchemaRepository } from "./SchemaRepository";

interface EmployeeRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string | null;
  salary: number | string;
  status: EmployeeStatus;
}

export class EmployeeRepository extends SchemaRepository {
  public async ensureSchema(): Promise<void> {
    await this.ensureEmployeeProfileSchema();
  }

  public async findAll(): Promise<Employee[]> {
    await this.ensureSchema();
    const rows = await this.query<EmployeeRow[]>(`
      SELECT u.id,
        u.name,
        u.email,
        ep.department,
        ep.position,
        DATE_FORMAT(ep.start_date, '%Y-%m-%d') AS startDate,
        ep.base_salary AS salary,
        ep.status
      FROM users u
      INNER JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.role = 'staff'
      ORDER BY u.created_at DESC, u.id DESC
    `);
    return rows.map((row) => this.toEmployee(row));
  }

  public async findById(id: number): Promise<Employee | null> {
    await this.ensureSchema();
    const rows = await this.query<EmployeeRow[]>(
      `
        SELECT u.id,
          u.name,
          u.email,
          ep.department,
          ep.position,
          DATE_FORMAT(ep.start_date, '%Y-%m-%d') AS startDate,
          ep.base_salary AS salary,
          ep.status
        FROM users u
        INNER JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.role = 'staff' AND u.id = ?
      `,
      [id],
    );
    return rows.length > 0 ? this.toEmployee(rows[0]) : null;
  }

  public async findByEmail(email: string): Promise<Employee | null> {
    const rows = await this.query<EmployeeRow[]>(
      `
        SELECT u.id,
          u.name,
          u.email,
          ep.department,
          ep.position,
          DATE_FORMAT(ep.start_date, '%Y-%m-%d') AS startDate,
          ep.base_salary AS salary,
          ep.status
        FROM users u
        INNER JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.email = ? AND u.role = 'staff'
      `,
      [email],
    );
    return rows.length > 0 ? this.toEmployee(rows[0]) : null;
  }

  public async create(
    data: CreateEmployeeRequest,
    hashedPassword: string,
  ): Promise<Employee> {
    await this.ensureSchema();
    const userId = await this.transaction(async (connection) => {
      const [result] = await connection.execute<any>(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'staff')",
        [data.name, data.email, hashedPassword],
      );
      const userId = Number(result.insertId);

      await connection.execute(
        `
          INSERT INTO employee_profiles
            (user_id, department, position, start_date, base_salary, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          data.department,
          data.position,
          data.startDate || null,
          this.normalizeSalary(data.salary),
          data.status || "active",
        ],
      );

      return userId;
    });

    return (await this.findById(userId)) as Employee;
  }

  public async update(id: number, data: UpdateEmployeeRequest): Promise<Employee | null> {
    await this.ensureSchema();
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    await this.transaction(async (connection) => {
      await connection.execute(
        "UPDATE users SET name = ?, email = ? WHERE id = ? AND role = 'staff'",
        [data.name, data.email, id],
      );
      await connection.execute(
        `
          INSERT INTO employee_profiles
            (user_id, department, position, start_date, base_salary, status)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            department = VALUES(department),
            position = VALUES(position),
            start_date = VALUES(start_date),
            base_salary = VALUES(base_salary),
            status = VALUES(status)
        `,
        [
          id,
          data.department,
          data.position,
          data.startDate || null,
          this.normalizeSalary(data.salary),
          data.status,
        ],
      );
    });

    return await this.findById(id);
  }

  public async delete(id: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.execute(
      "DELETE FROM users WHERE id = ? AND role = 'staff'",
      [id],
    );
    return result.affectedRows > 0;
  }

  public async emailBelongsToAnotherStaff(
    email: string,
    employeeId: number,
  ): Promise<boolean> {
    const rows = await this.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [email, employeeId],
    );
    return rows.length > 0;
  }

  private toEmployee(row: EmployeeRow): Employee {
    return {
      id: Number(row.id),
      name: row.name,
      email: row.email,
      department: row.department,
      position: row.position,
      startDate: row.startDate,
      salary: Number(row.salary || 0),
      status: row.status,
    };
  }

  private normalizeSalary(value: string | number): number {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
