import { AttendanceRepository } from "../repositories/AttendanceRepository";
import {
  AttendanceDashboard,
  AttendanceMarkItem,
  AttendanceStatus,
  MarkAttendanceRequest,
} from "../models/Attendance";

const VALID_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "on_leave"];

export class AttendanceService {
  constructor(private readonly attendanceRepository = new AttendanceRepository()) {}

  public async getAdminDashboard(
    date: string,
    month: number,
    year: number,
    department?: string,
  ): Promise<AttendanceDashboard> {
    const employees = await this.attendanceRepository.findEmployees();
    const dayRecords = await this.attendanceRepository.findRecordsByDate(date);
    const summary = await this.attendanceRepository.getMonthlySummary(month, year, department);
    const departments = Array.from(new Set(employees.map((employee) => employee.department))).sort();
    const present = dayRecords.filter((record) => record.status === "present").length;
    const absent = dayRecords.filter((record) => record.status === "absent").length;
    const late = dayRecords.filter((record) => record.status === "late").length;
    const onLeave = dayRecords.filter((record) => record.status === "on_leave").length;
    const marked = present + absent + late + onLeave;

    return {
      date,
      month,
      year,
      employees,
      dayRecords,
      summary,
      departments,
      totals: {
        present,
        absent,
        late,
        onLeave,
        attendanceRate: marked > 0 ? Math.round(((present + late) / marked) * 100) : 0,
      },
    };
  }

  public async markAttendance(data: MarkAttendanceRequest, adminUserId: number): Promise<void> {
    for (const record of data.records) {
      await this.attendanceRepository.upsertRecord(
        Number(record.userId),
        data.date,
        record.status,
        record.note?.trim() || null,
        adminUserId,
      );
    }
  }

  public async getStaffHistory(userId: number, month: number, year: number) {
    const records = await this.attendanceRepository.findRecordsForUser(userId, month, year);
    const present = records.filter((record) => record.status === "present").length;
    const absent = records.filter((record) => record.status === "absent").length;
    const late = records.filter((record) => record.status === "late").length;
    const onLeave = records.filter((record) => record.status === "on_leave").length;
    const total = records.length;

    return {
      month,
      year,
      records,
      totals: {
        present,
        absent,
        late,
        onLeave,
        attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      },
    };
  }

  public validateMarkRequest(data: Partial<MarkAttendanceRequest>): string | null {
    if (!data.date || !this.isDate(data.date)) {
      return "A valid attendance date is required";
    }

    if (!Array.isArray(data.records) || data.records.length === 0) {
      return "At least one attendance record is required";
    }

    const invalidRecord = data.records.find((record) => !this.isValidRecord(record));
    if (invalidRecord) {
      return "Each record must include a valid employee and status";
    }

    return null;
  }

  public parseMonth(value: unknown): number {
    const month = Number(value);
    const currentMonth = new Date().getMonth() + 1;
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : currentMonth;
  }

  public parseYear(value: unknown): number {
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : currentYear;
  }

  public normalizeDate(value: unknown): string {
    if (typeof value === "string" && this.isDate(value)) {
      return value;
    }
    return new Date().toISOString().slice(0, 10);
  }

  private isValidRecord(record: AttendanceMarkItem): boolean {
    return Number.isInteger(Number(record.userId)) && Number(record.userId) > 0 && VALID_STATUSES.includes(record.status);
  }

  private isDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
  }
}
