import { RowDataPacket } from "mysql2";
import {
  CreateEmployeeRequest,
  Employee,
  EmployeeStatus,
  UpdateOwnProfileRequest,
  UpdateEmployeeRequest,
} from "../models/Employee";
import { SchemaRepository } from "./SchemaRepository";

interface EmployeeRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  loginPassword: string | null;
  department: string;
  position: string;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: string | null;
  profilePhoto: string | null;
  startDate: string | null;
  salary: number | string;
  status: EmployeeStatus;
}

export class EmployeeRepository extends SchemaRepository {
  public async findAll(): Promise<Employee[]> {
    const rows = await this.query<EmployeeRow[]>(`
      SELECT u.id,
        u.name,
        u.email,
        u.login_password AS loginPassword,
        e.department,
        e.position,
        ep.phone_number AS phoneNumber,
        ep.address,
        DATE_FORMAT(ep.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
        ep.profile_photo AS profilePhoto,
        DATE_FORMAT(e.start_date, '%Y-%m-%d') AS startDate,
        e.base_salary AS salary,
        e.status
      FROM users u
      INNER JOIN employees e ON e.user_id = u.id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.role = 'staff'
      ORDER BY u.created_at DESC, u.id DESC
    `);
    return rows.map((row) => this.toEmployee(row));
  }

  public async findById(id: number): Promise<Employee | null> {
    const rows = await this.query<EmployeeRow[]>(
      `
        SELECT u.id,
          u.name,
          u.email,
          u.login_password AS loginPassword,
          e.department,
          e.position,
          ep.phone_number AS phoneNumber,
          ep.address,
          DATE_FORMAT(ep.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
          ep.profile_photo AS profilePhoto,
          DATE_FORMAT(e.start_date, '%Y-%m-%d') AS startDate,
          e.base_salary AS salary,
          e.status
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        LEFT JOIN employee_profiles ep ON ep.user_id = u.id
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
          u.login_password AS loginPassword,
          e.department,
          e.position,
          ep.phone_number AS phoneNumber,
          ep.address,
          DATE_FORMAT(ep.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
          ep.profile_photo AS profilePhoto,
          DATE_FORMAT(e.start_date, '%Y-%m-%d') AS startDate,
          e.base_salary AS salary,
          e.status
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        LEFT JOIN employee_profiles ep ON ep.user_id = u.id
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
    const userId = await this.transaction(async (connection) => {
      const [result] = await connection.execute<any>(
        "INSERT INTO users (name, email, password, login_password, role) VALUES (?, ?, ?, ?, 'staff')",
        [data.name, data.email, hashedPassword, data.password],
      );
      const userId = Number(result.insertId);

      await connection.execute(
        `
          INSERT INTO employees
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

      // Create empty profile
      await connection.execute(
        "INSERT INTO employee_profiles (user_id) VALUES (?)",
        [userId]
      );

      return userId;
    });

    return (await this.findById(userId)) as Employee;
  }

  public async update(
    id: number,
    data: UpdateEmployeeRequest,
    hashedPassword?: string,
    loginPassword?: string,
  ): Promise<Employee | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    await this.transaction(async (connection) => {
      if (hashedPassword) {
        await connection.execute(
          "UPDATE users SET name = ?, email = ?, password = ?, login_password = ? WHERE id = ? AND role = 'staff'",
          [data.name, data.email, hashedPassword, loginPassword || null, id],
        );
      } else {
        await connection.execute(
          "UPDATE users SET name = ?, email = ? WHERE id = ? AND role = 'staff'",
          [data.name, data.email, id],
        );
      }
      await connection.execute(
        `
          INSERT INTO employees
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

  public async updateOwnProfile(
    userId: number,
    data: UpdateOwnProfileRequest,
  ): Promise<Employee | null> {
    await this.transaction(async (connection) => {
      if (typeof data.name === "string") {
        await connection.execute(
          "UPDATE users SET name = ? WHERE id = ? AND role = 'staff'",
          [data.name.trim(), userId],
        );
      }

      await connection.execute(
        `
          INSERT INTO employee_profiles (user_id, phone_number, address, date_of_birth, profile_photo)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            phone_number = VALUES(phone_number),
            address = VALUES(address),
            date_of_birth = VALUES(date_of_birth),
            profile_photo = VALUES(profile_photo)
        `,
        [
          userId,
          data.phoneNumber?.trim() || null,
          data.address?.trim() || null,
          data.dateOfBirth || null,
          data.profilePhoto || null
        ],
      );
    });

    return await this.findById(userId);
  }

  private toEmployee(row: EmployeeRow): Employee {
    return {
      id: Number(row.id),
      name: row.name,
      email: row.email,
      loginPassword: row.loginPassword,
      department: row.department,
      position: row.position,
      phoneNumber: row.phoneNumber,
      address: row.address,
      dateOfBirth: row.dateOfBirth,
      profilePhoto: row.profilePhoto,
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
