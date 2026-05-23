import { Request, Response } from "express";
import { DashboardService } from "../services/DashboardService";
import { BaseController } from "./BaseController";

export class DashboardController extends BaseController {
  constructor(private readonly dashboardService = new DashboardService()) {
    super();
  }

  public async getDashboard(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      this.sendError(res, 401, "Authentication required");
      return;
    }

    await this.handle(res, "Dashboard error", async () => {
      res.json(await this.dashboardService.getDashboard(user));
    });
  }
}
