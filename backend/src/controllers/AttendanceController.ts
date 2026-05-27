import { Request, Response } from "express";
import { MarkAttendanceRequest } from "../models/Attendance";
import { AttendanceService } from "../services/AttendanceService";
import { HttpResponse } from "../utils/HttpResponse";

export class AttendanceController {
  constructor(private readonly attendanceService = new AttendanceService()) {}

  public async getAdminDashboard(req: Request, res: Response): Promise<void> {
    try {
      const date = this.attendanceService.normalizeDate(req.query.date);
      const month = this.attendanceService.parseMonth(req.query.month);
      const year = this.attendanceService.parseYear(req.query.year);
      const department = typeof req.query.department === "string" && req.query.department ? req.query.department : undefined;
      const dashboard = await this.attendanceService.getAdminDashboard(date, month, year, department);
      res.json(dashboard);
    } catch (err) {
      console.error("Attendance dashboard error:", err);
      HttpResponse.error(res, 500, "Unable to load attendance dashboard");
    }
  }

  public async markAttendance(req: Request, res: Response): Promise<void> {
    const data = req.body as Partial<MarkAttendanceRequest>;
    const error = this.attendanceService.validateMarkRequest(data);
    if (error) {
      HttpResponse.error(res, 400, error);
      return;
    }

    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    try {
      await this.attendanceService.markAttendance(data as MarkAttendanceRequest, req.user.id);
      res.json({ message: "Attendance saved" });
    } catch (err) {
      console.error("Mark attendance error:", err);
      HttpResponse.error(res, 500, "Unable to save attendance");
    }
  }

  public async getStaffHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    try {
      const month = this.attendanceService.parseMonth(req.query.month);
      const year = this.attendanceService.parseYear(req.query.year);
      const history = await this.attendanceService.getStaffHistory(req.user.id, month, year);
      res.json(history);
    } catch (err) {
      console.error("Staff attendance history error:", err);
      HttpResponse.error(res, 500, "Unable to load attendance history");
    }
  }
}
