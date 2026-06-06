import express, { Application as ExpressApplication } from "express";
import cors from "cors";
import path from "path";
import { envConfig } from "./config/env";
import { AuthRoutes } from "./routes/AuthRoutes";
import { DashboardRoutes } from "./routes/DashboardRoutes";
import { EmployeeRoutes } from "./routes/EmployeeRoutes";
import { AttendanceRoutes } from "./routes/AttendanceRoutes";
import { LeaveRequestRoutes } from "./routes/LeaveRequestRoutes";
import { PayrollRoutes } from "./routes/PayrollRoutes";
import { EmployeeRepository } from "./repositories/EmployeeRepository";

class App {
  private readonly app: ExpressApplication;

  constructor() {
    envConfig.validate();
    this.app = express();

    this.configureMiddlewares();
    this.configureRoutes();
    this.configureFrontendFallback();
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const employeeRepo = new EmployeeRepository();
      await employeeRepo.initializeSchema();
    } catch (error) {
      console.error("Failed to initialize database schema:", error);
    }
  }

  public start(): void {
    const server = this.app.listen(envConfig.port, () => {
      console.log(`Server running on http://localhost:${envConfig.port}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall === "listen" && error.code === "EADDRINUSE") {
        console.error(`Port ${envConfig.port} is already in use. Please stop the process using it or set PORT to a different value.`);
        process.exit(1);
      }
      throw error;
    });
  }

  private configureMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: "5mb" }));
    this.app.use(express.urlencoded({ limit: "5mb", extended: true }));
    this.app.use(express.static(path.join(__dirname, "../frontend")));
  }

  private configureRoutes(): void {
    const authRoutes = new AuthRoutes();
    const dashboardRoutes = new DashboardRoutes();
    const employeeRoutes = new EmployeeRoutes();
    const attendanceRoutes = new AttendanceRoutes();
    const leaveRequestRoutes = new LeaveRequestRoutes();
    const payrollRoutes = new PayrollRoutes();
    this.app.use("/api/auth", authRoutes.router);
    this.app.use("/api/dashboard", dashboardRoutes.router);
    this.app.use("/api/employees", employeeRoutes.router);
    this.app.use("/api/attendance", attendanceRoutes.router);
    this.app.use("/api/leave-requests", leaveRequestRoutes.router);
    this.app.use("/api/payroll", payrollRoutes.router);
  }

  private configureFrontendFallback(): void {
    this.app.get("/admin/dashboard.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/admin/dashboard.html"));
    });
    this.app.get("/admin/employees.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/admin/employees.html"));
    });
    this.app.get("/admin/attendanceTracking.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/admin/attendanceTracking.html"));
    });
    this.app.get("/admin/leaveRequest.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/admin/leaveRequest.html"));
    });
    this.app.get("/admin/payroll.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/admin/payroll.html"));
    });
    this.app.get("/staff/dashboard.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/dashboard.html"));
    });
    this.app.get("/staff/profile.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/profile.html"));
    });
    this.app.get("/staff/attendanceTracking.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/attendanceTracking.html"));
    });
    this.app.get("/staff/attendanceTraking.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/attendanceTracking.html"));
    });
    this.app.get("/staff/LeaveRequest.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/LeaveRequest.html"));
    });
    this.app.get("/staff/payslip.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/payslip.html"));
    });
    this.app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/login.html"));
    });
  }
}

new App().start();
