import { DashboardController } from "../controllers/DashboardController";
import { BaseRoutes } from "./BaseRoutes";

export class DashboardRoutes extends BaseRoutes {
  private readonly dashboardController = new DashboardController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.get(
      "/",
      ...this.authenticated(),
      this.dashboardController.getDashboard.bind(this.dashboardController),
    );
  }
}
