import { Request, Response } from "express";
import { LeaveRequestService } from "../services/leaveRequestService";
import { CreateLeaveRequest, ReviewLeaveRequest } from "../models/LeaveRequest";
import { HttpResponse } from "../utils/HttpResponse";

export class LeaveRequestController {
  constructor(private readonly leaveRequestService = new LeaveRequestService()) {}

  public async submit(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    const data = req.body as Partial<CreateLeaveRequest>;
    const error = this.leaveRequestService.validateCreateRequest(data);
    if (error) {
      HttpResponse.error(res, 400, error);
      return;
    }

    try {
      const request = await this.leaveRequestService.submit(req.user.id, data as CreateLeaveRequest);
      res.status(201).json({ message: "Leave request submitted", request });
    } catch (err) {
      console.error("Submit leave request error:", err);
      HttpResponse.error(res, 500, "Unable to submit leave request");
    }
  }

  public async getMyRequests(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    try {
      const requests = await this.leaveRequestService.getStaffRequests(req.user.id);
      res.json({ requests });
    } catch (err) {
      console.error("Staff leave request list error:", err);
      HttpResponse.error(res, 500, "Unable to load leave requests");
    }
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    try {
      const request = await this.leaveRequestService.cancel(req.user.id, req.params.id);
      if (!request) {
        HttpResponse.error(res, 404, "Pending leave request was not found");
        return;
      }

      res.json({ message: "Leave request cancelled", request });
    } catch (err) {
      console.error("Cancel leave request error:", err);
      HttpResponse.error(res, 500, "Unable to cancel leave request");
    }
  }

  public async getAdminRequests(req: Request, res: Response): Promise<void> {
    try {
      const status = this.leaveRequestService.parseStatus(req.query.status);
      const requests = await this.leaveRequestService.getAdminRequests(status);
      res.json({ requests });
    } catch (err) {
      console.error("Admin leave request list error:", err);
      HttpResponse.error(res, 500, "Unable to load leave requests");
    }
  }

  public async approve(req: Request, res: Response): Promise<void> {
    await this.review(req, res, "approve");
  }

  public async reject(req: Request, res: Response): Promise<void> {
    await this.review(req, res, "reject");
  }

  private async review(
    req: Request,
    res: Response,
    action: "approve" | "reject",
  ): Promise<void> {
    if (!req.user) {
      HttpResponse.error(res, 401, "Authentication required");
      return;
    }

    const data = req.body as Partial<ReviewLeaveRequest>;
    const error = this.leaveRequestService.validateReviewRequest(data, action === "reject");
    if (error) {
      HttpResponse.error(res, 400, error);
      return;
    }

    try {
      const request = action === "approve"
        ? await this.leaveRequestService.approve(req.user.id, req.params.id, data)
        : await this.leaveRequestService.reject(req.user.id, req.params.id, data);

      if (!request) {
        HttpResponse.error(res, 404, "Pending leave request was not found");
        return;
      }

      const pastTense = action === "approve" ? "approved" : "rejected";
      res.json({ message: `Leave request ${pastTense}`, request });
    } catch (err) {
      console.error(`${action} leave request error:`, err);
      HttpResponse.error(res, 500, `Unable to ${action} leave request`);
    }
  }
}
