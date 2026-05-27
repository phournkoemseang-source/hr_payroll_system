import { AttendanceController } from "../controllers/AttendanceController";
import { BaseRoutes } from "./BaseRoutes";

export class AttendanceRoutes extends BaseRoutes {
  private readonly attendanceController = new AttendanceController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.get(
      "/admin/dashboard",
      ...this.adminOnly(),
      this.attendanceController.getAdminDashboard.bind(this.attendanceController),
    );
    this.router.get(
      "/admin",
      ...this.adminOnly(),
      this.attendanceController.getAdminDashboard.bind(this.attendanceController),
    );
    this.router.post(
      "/admin/mark",
      ...this.adminOnly(),
      this.attendanceController.markAttendance.bind(this.attendanceController),
    );
    this.router.post(
      "/staff",
      ...this.adminOnly(),
      this.attendanceController.markAttendance.bind(this.attendanceController),
    );
    this.router.get(
      "/staff/history",
      ...this.authenticated(),
      this.attendanceController.getStaffHistory.bind(this.attendanceController),
    );
    this.router.get(
      "/staff",
      ...this.authenticated(),
      this.attendanceController.getStaffHistory.bind(this.attendanceController),
    );
  }
}
