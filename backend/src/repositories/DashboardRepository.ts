import { RowDataPacket } from "mysql2";
import {
  AttendanceDay,
  PendingLeaveRequest,
  RecentEmployee,
  StaffDashboardProfile,
} from "../models/Dashboard";
import { SchemaRepository } from "./SchemaRepository";

interface CountRow extends RowDataPacket {
  total: number;
}

interface PayrollRow extends RowDataPacket {
  total: number | string | null;
}

interface AttendanceCountRow extends RowDataPacket {
  work_date: string;
  present: number;
  absent: number;
}

interface StaffProfileRow extends RowDataPacket, StaffDashboardProfile {}

interface AttendanceStatusRow extends RowDataPacket {
  status: string;
}

export class DashboardRepository extends SchemaRepository {
  public async ensureSchema(): Promise<void> {
    await this.ensureHrSchema();
  }

  public async countActiveStaff(): Promise<number> {
    return this.singleCount(`
      SELECT COUNT(*) AS total
      FROM users u
      INNER JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.role = 'staff' AND ep.status = 'active'
    `);
  }

  public async countStaffAddedThisMonth(): Promise<number> {
    return this.singleCount(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'staff'
        AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
    `);
  }

  public async countPresentToday(): Promise<number> {
    return this.singleCount(`
      SELECT COUNT(DISTINCT ar.user_id) AS total
      FROM attendance_records ar
      INNER JOIN users u ON u.id = ar.user_id
      INNER JOIN employee_profiles ep ON ep.user_id = u.id
      WHERE u.role = 'staff'
        AND ep.status = 'active'
        AND ar.work_date = CURRENT_DATE()
        AND ar.status IN ('present', 'late')
    `);
  }

  public async countPendingLeaves(): Promise<number> {
    return this.singleCount(`
      SELECT COUNT(*) AS total
      FROM leave_requests
      WHERE status = 'pending'
    `);
  }

  public async getTotalPayroll(): Promise<number> {
    const rows = await this.query<PayrollRow[]>(`
      SELECT COALESCE(SUM(NULLIF(pr.net_pay, 0)), SUM(pr.gross_pay), SUM(ep.base_salary), 0) AS total
      FROM users u
      INNER JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN payroll_records pr
        ON pr.user_id = u.id
        AND pr.pay_period >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
        AND pr.pay_period < DATE_ADD(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
      WHERE u.role = 'staff' AND ep.status = 'active'
    `);
    return Number(rows[0]?.total || 0);
  }

  public async getAttendanceWeek(days: { label: string; date: string }[]): Promise<AttendanceDay[]> {
    if (days.length === 0) {
      return [];
    }

    const rows = await this.query<AttendanceCountRow[]>(
      `
        SELECT DATE_FORMAT(ar.work_date, '%Y-%m-%d') AS work_date,
          SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent
        FROM attendance_records ar
        INNER JOIN users u ON u.id = ar.user_id
        INNER JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.role = 'staff'
          AND ep.status = 'active'
          AND ar.work_date IN (${days.map(() => "?").join(", ")})
        GROUP BY ar.work_date
      `,
      days.map((day) => day.date),
    );

    const byDate = new Map(
      rows.map((row) => [
        row.work_date,
        {
          present: Number(row.present || 0),
          absent: Number(row.absent || 0),
        },
      ]),
    );

    return days.map((day) => ({
      ...day,
      present: byDate.get(day.date)?.present || 0,
      absent: byDate.get(day.date)?.absent || 0,
    }));
  }

  public async getPendingLeaves(): Promise<PendingLeaveRequest[]> {
    const rows = await this.query<RowDataPacket[]>(`
      SELECT lr.id,
        u.name AS employeeName,
        lr.leave_type AS leaveType,
        DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS endDate
      FROM leave_requests lr
      INNER JOIN users u ON u.id = lr.user_id
      WHERE lr.status = 'pending'
      ORDER BY lr.start_date ASC, lr.created_at ASC
      LIMIT 3
    `);
    return rows as PendingLeaveRequest[];
  }

  public async getRecentEmployees(): Promise<RecentEmployee[]> {
    const rows = await this.query<RowDataPacket[]>(`
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
      LIMIT 5
    `);
    return rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: String(row.email),
      department: String(row.department),
      position: String(row.position),
      startDate: row.startDate ? String(row.startDate) : null,
      salary: Number(row.salary || 0),
      status: String(row.status),
    }));
  }

  public async getStaffProfile(userId: number): Promise<StaffDashboardProfile | null> {
    const rows = await this.query<StaffProfileRow[]>(
      `
        SELECT u.id,
          u.name,
          u.email,
          CONCAT('EMP-', LPAD(u.id, 4, '0')) AS employeeId,
          ep.phone_number AS phoneNumber,
          ep.address,
          DATE_FORMAT(ep.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
          ep.department,
          ep.position,
          DATE_FORMAT(ep.start_date, '%Y-%m-%d') AS startDate,
          ep.base_salary AS salary,
          ep.status
        FROM users u
        INNER JOIN employee_profiles ep ON ep.user_id = u.id
        WHERE u.id = ? AND u.role = 'staff'
      `,
      [userId],
    );
    return rows.length > 0
      ? {
          id: Number(rows[0].id),
          name: rows[0].name,
          email: rows[0].email,
          employeeId: rows[0].employeeId,
          phoneNumber: rows[0].phoneNumber,
          address: rows[0].address,
          dateOfBirth: rows[0].dateOfBirth,
          department: rows[0].department,
          position: rows[0].position,
          startDate: rows[0].startDate,
          salary: Number(rows[0].salary || 0),
          status: rows[0].status,
        }
      : null;
  }

  public async getTodayAttendance(userId: number): Promise<string | null> {
    const rows = await this.query<AttendanceStatusRow[]>(
      "SELECT status FROM attendance_records WHERE user_id = ? AND work_date = CURRENT_DATE() LIMIT 1",
      [userId],
    );
    return rows[0]?.status || null;
  }

  public async countPendingLeavesByUser(userId: number): Promise<number> {
    return this.singleCount(
      "SELECT COUNT(*) AS total FROM leave_requests WHERE user_id = ? AND status = 'pending'",
      [userId],
    );
  }

  public async getLatestPayrollByUser(userId: number): Promise<number> {
    const rows = await this.query<PayrollRow[]>(
      `
        SELECT COALESCE(NULLIF(net_pay, 0), gross_pay) AS total
        FROM payroll_records
        WHERE user_id = ?
        ORDER BY pay_period DESC, id DESC
        LIMIT 1
      `,
      [userId],
    );
    return Number(rows[0]?.total || 0);
  }

  private async singleCount(sql: string, params?: unknown[]): Promise<number> {
    const rows = await this.query<CountRow[]>(sql, params);
    return Number(rows[0]?.total || 0);
  }
}
