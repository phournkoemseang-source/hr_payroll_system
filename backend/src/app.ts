import express, { Application as ExpressApplication } from "express";
import cors from "cors";
import path from "path";
import { envConfig } from "./config/env";
import { AuthRoutes } from "./routes/AuthRoutes";
import { DashboardRoutes } from "./routes/DashboardRoutes";
import { EmployeeRoutes } from "./routes/EmployeeRoutes";
import { AttendanceRoutes } from "./routes/AttendanceRoutes";

class App {
  private readonly app: ExpressApplication;

  constructor() {
    envConfig.validate();
    this.app = express();

    this.configureMiddlewares();
    this.configureRoutes();
    this.configureFrontendFallback();
  }

  public start(): void {
    this.app.listen(envConfig.port, () => {
      console.log(`Server running on http://localhost:${envConfig.port}`);
    });
  }

  private configureMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../frontend")));
  }

  private configureRoutes(): void {
    const authRoutes = new AuthRoutes();
    const dashboardRoutes = new DashboardRoutes();
    const employeeRoutes = new EmployeeRoutes();
    const attendanceRoutes = new AttendanceRoutes();
    this.app.use("/api/auth", authRoutes.router);
    this.app.use("/api/dashboard", dashboardRoutes.router);
    this.app.use("/api/employees", employeeRoutes.router);
    this.app.use("/api/attendance", attendanceRoutes.router);
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
    this.app.get("/staff/dashboard.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/dashboard.html"));
    });
    this.app.get("/staff/attendanceTracking.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/attendanceTracking.html"));
    });
    this.app.get("/staff/attendanceTraking.html", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/staff/attendanceTracking.html"));
    });
    this.app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/login.html"));
    });
  }
}

new App().start();
