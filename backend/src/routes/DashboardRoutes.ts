import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";

export class DashboardRoutes {
  public readonly router = Router();
  private readonly dashboardController = new DashboardController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      "/",
      AuthMiddleware.verifyToken,
      this.dashboardController.getDashboard.bind(this.dashboardController),
    );
  }
}
