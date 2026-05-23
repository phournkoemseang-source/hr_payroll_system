import { DashboardRepository } from "../repositories/DashboardRepository";
import { DashboardResponse } from "../models/Dashboard";
import { JwtPayload } from "../models/Auth";

export class DashboardService {
  constructor(private readonly dashboardRepository = new DashboardRepository()) {}

  public async getDashboard(user: JwtPayload): Promise<DashboardResponse> {
    await this.dashboardRepository.ensureSchema();

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
      const [profile, todayAttendance, staffPendingLeaveRequests, latestPayroll] =
        await Promise.all([
          this.dashboardRepository.getStaffProfile(user.id),
          this.dashboardRepository.getTodayAttendance(user.id),
          this.dashboardRepository.countPendingLeavesByUser(user.id),
          this.dashboardRepository.getLatestPayrollByUser(user.id),
        ]);

      response.staff = {
        profile,
        todayAttendance,
        pendingLeaveRequests: staffPendingLeaveRequests,
        latestPayroll,
      };
    }

    return response;
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
