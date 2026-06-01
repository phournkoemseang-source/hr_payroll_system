import { Request, Response } from "express";
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from "../models/Employee";
import { EmployeeService } from "../services/EmployeeService";
import { EmployeeValidation } from "../validations/EmployeeValidation";
import { BaseController } from "./BaseController";

export class EmployeeController extends BaseController {
  constructor(private readonly employeeService = new EmployeeService()) {
    super();
  }

  public async list(req: Request, res: Response): Promise<void> {
    await this.handle(res, "List employees error", async () => {
      res.json({ employees: await this.employeeService.listEmployees() });
    });
  }

  public async updateOwnProfile(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user || user.role !== "staff") {
      this.sendError(res, 403, "Staff access required");
      return;
    }

    await this.handle(res, "Update profile error", async () => {
      const updated = await this.employeeService.updateOwnProfile(user.id, req.body);
      if (!updated) {
        this.sendError(res, 404, "Staff profile not found");
        return;
      }

      res.json({ message: "Profile updated." });
    });
  }

  public async create(req: Request, res: Response): Promise<void> {
    const error = EmployeeValidation.validateCreate(
      req.body as Partial<CreateEmployeeRequest>,
    );
    if (error) {
      this.sendError(res, 400, error);
      return;
    }

    await this.handle(res, "Create employee error", async () => {
      const result = await this.employeeService.createEmployee(
        req.body as CreateEmployeeRequest,
      );
      if (result === "email_exists") {
        this.sendError(res, 409, "A staff employee with this email already exists");
        return;
      }

      res.status(201).json({ employee: result });
    });
  }

  public async update(req: Request, res: Response): Promise<void> {
    const id = this.parsePositiveId(req.params.id);
    if (!id) {
      this.sendError(res, 400, "Employee id must be valid");
      return;
    }

    const error = EmployeeValidation.validateUpdate(
      req.body as Partial<UpdateEmployeeRequest>,
    );
    if (error) {
      this.sendError(res, 400, error);
      return;
    }

    await this.handle(res, "Update employee error", async () => {
      const result = await this.employeeService.updateEmployee(
        id,
        req.body as UpdateEmployeeRequest,
      );
      if (result === "not_found") {
        this.sendError(res, 404, "Staff employee not found");
        return;
      }
      if (result === "email_exists") {
        this.sendError(res, 409, "A user with this email already exists");
        return;
      }

      res.json({ employee: result });
    });
  }

  public async delete(req: Request, res: Response): Promise<void> {
    const id = this.parsePositiveId(req.params.id);
    if (!id) {
      this.sendError(res, 400, "Employee id must be valid");
      return;
    }

    await this.handle(res, "Delete employee error", async () => {
      const deleted = await this.employeeService.deleteEmployee(id);
      if (!deleted) {
        this.sendError(res, 404, "Staff employee not found");
        return;
      }

      res.status(204).send();
    });
  }
}
