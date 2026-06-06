import { DashboardRepository } from "../repositories/DashboardRepository";
import {
  AttendanceDay,
  DashboardResponse,
  PendingLeaveRequest,
} from "../models/Dashboard";
import { JwtPayload } from "../models/Auth";

export class DashboardService {
  constructor(private readonly dashboardRepository = new DashboardRepository()) {}

  public async getDashboard(user: JwtPayload): Promise<DashboardResponse> {
    const [
      totalEmployees,
      employeesAddedThisMonth,
      presentToday,
      pendingLeaveRequests,
      totalPayroll,
      attendanceWeek,
      pendingLeaves,
      recentEmployees,
    ] = await Promise.all([
      this.dashboardRepository.countActiveStaff(),
      this.dashboardRepository.countStaffAddedThisMonth(),
      this.dashboardRepository.countPresentToday(),
      this.dashboardRepository.countPendingLeaves(),
      this.dashboardRepository.getTotalPayroll(),
      this.dashboardRepository.getAttendanceWeek(this.getCurrentWorkWeek()),
      this.dashboardRepository.getPendingLeaves(),
      this.dashboardRepository.getRecentEmployees(),
    ]);

    const stats = {
      totalEmployees,
      employeesAddedThisMonth,
      presentToday,
      attendanceRate:
        totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0,
      pendingLeaveRequests,
      totalPayroll,
    };

    const response: DashboardResponse = {
      stats,
      attendanceWeek,
      pendingLeaves,
      recentEmployees,
    };

    if (user.role === "staff") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [profile, todayAttendance, pendingByUser, latestPayroll, attendanceMonth] =
        await Promise.all([
          this.dashboardRepository.getStaffProfile(user.id),
          this.dashboardRepository.getTodayAttendance(user.id),
          this.dashboardRepository.countPendingLeavesByUser(user.id),
          this.dashboardRepository.getLatestPayrollByUser(user.id),
          this.dashboardRepository.getAttendanceMonth(
            user.id,
            start.toISOString().slice(0, 10),
            end.toISOString().slice(0, 10),
          ),
        ]);

      response.staff = {
        profile,
        todayAttendance,
        pendingLeaveRequests: pendingByUser,
        latestPayroll,
      };

      // Override weekly attendance with monthly for staff dashboard
      response.attendanceWeek = this.applyCambodianHolidays(attendanceMonth);
    }

    return response;
    }

    private applyCambodianHolidays(days: AttendanceDay[]): AttendanceDay[] {
    const holidays2026: Record<string, string> = {
      "2026-01-01": "International New Year's Day",
      "2026-01-07": "Victory Day over Genocide",
      "2026-03-08": "International Women's Day",
      "2026-04-14": "Khmer New Year",
      "2026-04-15": "Khmer New Year",
      "2026-04-16": "Khmer New Year",
      "2026-05-01": "International Labour Day",
      "2026-05-14": "King's Birthday",
      "2026-05-31": "Visak Bochea Day",
      "2026-06-04": "Royal Ploughing Ceremony",
      "2026-06-18": "Queen Mother's Birthday",
      "2026-09-24": "Constitutional Day",
      "2026-10-09": "Pchum Ben Day",
      "2026-10-10": "Pchum Ben Day",
      "2026-10-11": "Pchum Ben Day",
      "2026-10-15": "Commemoration Day of King Father",
      "2026-10-29": "King's Coronation Day",
      "2026-11-09": "Independence Day",
      "2026-11-23": "Water Festival",
      "2026-11-24": "Water Festival",
      "2026-11-25": "Water Festival",
    };

    return days.map(day => {
      const holidayName = holidays2026[day.date];
      if (holidayName) {
        return { ...day, label: holidayName, isHoliday: true };
      }
      return day;
    });
    }


  private getCurrentWorkWeek(): { label: string; date: string }[] {
    const today = new Date();
    const day = today.getDay();
    const distanceFromMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceFromMonday);

    return Array.from({ length: 5 }, (_value, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        date: date.toISOString().slice(0, 10),
      };
    });
  }
}
