export type AttendanceStatus = "present" | "absent" | "late" | "on_leave";

export interface AttendanceEmployee {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff";
  department: string;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  attendanceDate: string;
  status: AttendanceStatus;
  note: string | null;
  updatedBy: number | null;
  updatedAt: string;
}

export interface AttendanceMarkItem {
  userId: number;
  status: AttendanceStatus;
  note?: string;
}

export interface MarkAttendanceRequest {
  date: string;
  records: AttendanceMarkItem[];
}

export interface AttendanceSummaryRow {
  userId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  totalMarked: number;
  attendanceRate: number;
}

export interface AttendanceDashboard {
  date: string;
  month: number;
  year: number;
  employees: AttendanceEmployee[];
  dayRecords: AttendanceRecord[];
  summary: AttendanceSummaryRow[];
  departments: string[];
  totals: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    attendanceRate: number;
  };
}
