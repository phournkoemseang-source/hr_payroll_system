export interface DashboardStats {
  totalEmployees: number;
  employeesAddedThisMonth: number;
  presentToday: number;
  attendanceRate: number;
  pendingLeaveRequests: number;
  totalPayroll: number;
}

export interface AttendanceDay {
  label: string;
  date: string;
  present: number;
  absent: number;
}

export interface PendingLeaveRequest {
  id: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export interface RecentEmployee {
  id: number;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string | null;
  salary: number;
  status: string;
}

export interface StaffDashboardProfile {
  department: string;
  position: string;
  startDate: string | null;
  salary: number;
  status: string;
}

export interface StaffDashboardSummary {
  profile: StaffDashboardProfile | null;
  todayAttendance: string | null;
  pendingLeaveRequests: number;
  latestPayroll: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  attendanceWeek: AttendanceDay[];
  pendingLeaves: PendingLeaveRequest[];
  recentEmployees: RecentEmployee[];
  staff?: StaffDashboardSummary;
}
