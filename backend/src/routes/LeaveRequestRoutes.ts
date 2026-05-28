import { LeaveRequestController } from "../controllers/LeaveRequestController";
import { BaseRoutes } from "./BaseRoutes";

export class LeaveRequestRoutes extends BaseRoutes {
  private readonly leaveRequestController = new LeaveRequestController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.post(
      "/staff",
      ...this.allowRoles("staff", "admin"),
      this.leaveRequestController.submit.bind(this.leaveRequestController),
    );

    this.router.get(
      "/staff",
      ...this.allowRoles("staff", "admin"),
      this.leaveRequestController.getMyRequests.bind(this.leaveRequestController),
    );

    this.router.patch(
      "/staff/:id/cancel",
      ...this.allowRoles("staff", "admin"),
      this.leaveRequestController.cancel.bind(this.leaveRequestController),
    );

    this.router.get(
      "/admin",
      ...this.adminOnly(),
      this.leaveRequestController.getAdminRequests.bind(this.leaveRequestController),
    );

    this.router.patch(
      "/admin/:id/approve",
      ...this.adminOnly(),
      this.leaveRequestController.approve.bind(this.leaveRequestController),
    );

    this.router.patch(
      "/admin/:id/reject",
      ...this.adminOnly(),
      this.leaveRequestController.reject.bind(this.leaveRequestController),
    );
  }
}
