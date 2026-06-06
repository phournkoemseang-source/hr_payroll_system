import { RowDataPacket } from "mysql2";
import { AttendanceEmployee, AttendanceRecord, AttendanceStatus, AttendanceSummaryRow } from "../models/Attendance";
import { SchemaRepository } from "./SchemaRepository";

interface AttendanceRecordRow extends RowDataPacket {
  id: number;
  user_id: number;
  employee_name: string;
  employee_email: string;
  department: string | null;
  work_date: Date | string;
  status: AttendanceStatus;
  note: string | null;
  updated_by: number | null;
  updated_at: Date | string;
}

interface AttendanceSummaryRowPacket extends RowDataPacket {
  user_id: number;
  employee_name: string;
  employee_email: string;
  department: string | null;
  present: number | string;
  absent: number | string;
  late: number | string;
  on_leave: number | string;
  total_marked: number | string;
}

interface EmployeeRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff";
  department: string | null;
}

export class AttendanceRepository extends SchemaRepository {
  public async findEmployees(): Promise<AttendanceEmployee[]> {
    const rows = await this.query<EmployeeRow[]>(`
      SELECT u.id, u.name, u.email, u.role, COALESCE(e.department, 'Management') AS department
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.role = 'staff'
      ORDER BY u.name ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      department: row.department || "Operations",
    }));
  }

  public async findRecordsByDate(date: string): Promise<AttendanceRecord[]> {
    const rows = await this.query<AttendanceRecordRow[]>(
      `
        SELECT ar.id, ar.user_id, u.name AS employee_name, u.email AS employee_email,
          COALESCE(e.department, 'Management') AS department, ar.work_date,
          ar.status, ar.note, ar.updated_by, ar.updated_at
        FROM attendance_records ar
        INNER JOIN users u ON u.id = ar.user_id
        LEFT JOIN employees e ON e.user_id = u.id
        WHERE ar.work_date = ?
        ORDER BY u.name ASC
      `,
      [date],
    );
    return rows.map((row) => this.toAttendanceRecord(row));
  }

  public async findRecordsForUser(userId: number, month: number, year: number): Promise<AttendanceRecord[]> {
    const rows = await this.query<AttendanceRecordRow[]>(
      `
        SELECT ar.id, ar.user_id, u.name AS employee_name, u.email AS employee_email,
          COALESCE(e.department, 'Management') AS department, ar.work_date,
          ar.status, ar.note, ar.updated_by, ar.updated_at
        FROM attendance_records ar
        INNER JOIN users u ON u.id = ar.user_id
        LEFT JOIN employees e ON e.user_id = u.id
        WHERE ar.user_id = ? AND MONTH(ar.work_date) = ? AND YEAR(ar.work_date) = ?
        ORDER BY ar.work_date DESC
      `,
      [userId, month, year],
    );
    return rows.map((row) => this.toAttendanceRecord(row));
  }

  public async upsertRecord(
    userId: number,
    workDate: string,
    status: AttendanceStatus,
    note: string | null,
    updatedBy: number,
  ): Promise<void> {
    await this.execute(
      `
        INSERT INTO attendance_records (user_id, work_date, status, note, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          note = VALUES(note),
          updated_by = VALUES(updated_by),
          updated_at = CURRENT_TIMESTAMP
      `,
      [userId, workDate, status, note, updatedBy],
    );
  }

  public async getMonthlySummary(month: number, year: number, department?: string): Promise<AttendanceSummaryRow[]> {
    const params: unknown[] = [month, year];
    const departmentFilter = department ? "AND COALESCE(e.department, 'Management') = ?" : "";
    if (department) {
      params.push(department);
    }

    const rows = await this.query<AttendanceSummaryRowPacket[]>(
      `
        SELECT u.id AS user_id, u.name AS employee_name, u.email AS employee_email,
          COALESCE(e.department, 'Management') AS department,
          SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent,
          SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS late,
          SUM(CASE WHEN ar.status = 'on_leave' THEN 1 ELSE 0 END) AS on_leave,
          COUNT(ar.id) AS total_marked
        FROM users u
        LEFT JOIN employees e ON e.user_id = u.id
        LEFT JOIN attendance_records ar
          ON ar.user_id = u.id
          AND MONTH(ar.work_date) = ?
          AND YEAR(ar.work_date) = ?
        WHERE u.role = 'staff'
        ${departmentFilter}
        GROUP BY u.id, u.name, u.email, e.department
        ORDER BY u.name ASC
      `,
      params,
    );

    return rows.map((row) => {
      const present = Number(row.present || 0);
      const late = Number(row.late || 0);
      const totalMarked = Number(row.total_marked || 0);
      return {
        userId: row.user_id,
        employeeName: row.employee_name,
        employeeEmail: row.employee_email,
        department: row.department || "Operations",
        present,
        absent: Number(row.absent || 0),
        late,
        onLeave: Number(row.on_leave || 0),
        totalMarked,
        attendanceRate: totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 0,
      };
    });
  }

  private toAttendanceRecord(row: AttendanceRecordRow): AttendanceRecord {
    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      department: row.department || "Operations",
      attendanceDate: this.formatDate(row.work_date),
      status: row.status,
      note: row.note,
      updatedBy: row.updated_by,
      updatedAt: this.formatDateTime(row.updated_at),
    };
  }

  private formatDate(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  private formatDateTime(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }
}
