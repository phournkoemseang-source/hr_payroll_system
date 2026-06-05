import { RowDataPacket } from "mysql2";
import {
  CreateLeaveRequest,
  LeaveRequestRecord,
  LeaveStatus,
  LeaveType,
} from "../models/LeaveRequest";
import { SchemaRepository } from "./SchemaRepository";

interface LeaveRequestRow extends RowDataPacket {
  id: number;
  user_id: number;
  employee_name: string;
  employee_email: string;
  leave_type: LeaveType;
  start_date: Date | string;
  end_date: Date | string;
  total_days: number | string;
  reason: string;
  status: LeaveStatus;
  reviewer_id: number | null;
  reviewer_name: string | null;
  reviewer_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class LeaveRequestRepository extends SchemaRepository {
  public async ensureSchema(): Promise<void> {
    await this.ensureLeaveRequestSchema();
  }

  public async create(userId: number, data: CreateLeaveRequest, totalDays: number): Promise<LeaveRequestRecord> {
    await this.ensureSchema();
    const result = await this.execute(
      `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, total_days, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, data.leaveType, data.startDate, data.endDate, totalDays, data.reason],
    );

    const request = await this.findById(result.insertId);
    if (!request) {
      throw new Error("Leave request was not created");
    }
    return request;
  }

  public async findById(id: number): Promise<LeaveRequestRecord | null> {
    await this.ensureSchema();
    const rows = await this.query<LeaveRequestRow[]>(
      `${this.baseSelect()} WHERE lr.id = ? LIMIT 1`,
      [id],
    );
    return rows.length > 0 ? this.toRecord(rows[0]) : null;
  }

  public async findForUser(userId: number): Promise<LeaveRequestRecord[]> {
    await this.ensureSchema();
    const rows = await this.query<LeaveRequestRow[]>(
      `${this.baseSelect()} WHERE lr.user_id = ? ORDER BY lr.created_at DESC, lr.id DESC`,
      [userId],
    );
    return rows.map((row) => this.toRecord(row));
  }

  public async findAll(status?: LeaveStatus): Promise<LeaveRequestRecord[]> {
    await this.ensureSchema();
    const filter = status ? "WHERE lr.status = ?" : "";
    const params = status ? [status] : [];
    const rows = await this.query<LeaveRequestRow[]>(
      `${this.baseSelect()} ${filter} ORDER BY lr.created_at DESC, lr.id DESC`,
      params,
    );
    return rows.map((row) => this.toRecord(row));
  }

  public async cancelPending(id: number, userId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.execute(
      `UPDATE leave_requests
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [id, userId],
    );
    return result.affectedRows === 1;
  }

  public async reviewPending(
    id: number,
    reviewerId: number,
    status: Extract<LeaveStatus, "approved" | "rejected">,
    reviewerNote: string | null,
  ): Promise<boolean> {
    await this.ensureSchema();
    const request = await this.findById(id);
    if (!request || request.status !== "pending") {
      return false;
    }

    return await this.transaction(async (connection) => {
      const [result] = await connection.execute<any>(
        `UPDATE leave_requests
         SET status = ?, reviewer_id = ?, reviewer_note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending'`,
        [status, reviewerId, reviewerNote, id],
      );

      if (result.affectedRows === 1 && status === "approved") {
        const column = request.leaveType === "sick" ? "sick_leave_balance" : "annual_leave_balance";
        // Only deduct for annual and sick leave types
        if (request.leaveType === "annual" || request.leaveType === "sick") {
          await connection.execute(
            `UPDATE employee_profiles
             SET ${column} = GREATEST(0, ${column} - ?)
             WHERE user_id = ?`,
            [request.totalDays, request.userId],
          );
        }
      }

      return result.affectedRows === 1;
    });
  }

  private baseSelect(): string {
    return `SELECT lr.id, lr.user_id, u.name AS employee_name, u.email AS employee_email,
                   lr.leave_type,
                   DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
                   DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
                   lr.total_days, lr.reason,
                   lr.status, lr.reviewer_id, reviewer.name AS reviewer_name,
                   lr.reviewer_note,
                   DATE_FORMAT(lr.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
                   DATE_FORMAT(lr.updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
            FROM leave_requests lr
            INNER JOIN users u ON u.id = lr.user_id
            LEFT JOIN users reviewer ON reviewer.id = lr.reviewer_id`;
  }

  private toRecord(row: LeaveRequestRow): LeaveRequestRecord {
    return {
      id: row.id,
      userId: row.user_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      leaveType: row.leave_type,
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      totalDays: Number(row.total_days),
      reason: row.reason,
      status: row.status,
      reviewerId: row.reviewer_id,
      reviewerName: row.reviewer_name,
      reviewerNote: row.reviewer_note,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}
