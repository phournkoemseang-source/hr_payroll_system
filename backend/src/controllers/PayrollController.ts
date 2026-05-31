import { Request, Response } from "express";
import { PayrollSettingsInput } from "../models/Payroll";
import { PayrollService } from "../services/PayrollService";
import { BaseController } from "./BaseController";

export class PayrollController extends BaseController {
  constructor(private readonly payrollService = new PayrollService()) {
    super();
  }

  public async getSettings(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveId(req.params.userId);
    if (!userId) {
      this.sendError(res, 400, "Employee id must be valid");
      return;
    }

    await this.handle(res, "Get payroll settings error", async () => {
      const settings = await this.payrollService.getSettings(userId);
      if (!settings) {
        this.sendError(res, 404, "Payroll settings not found");
        return;
      }

      res.json({ settings });
    });
  }

  public async saveSettings(req: Request, res: Response): Promise<void> {
    const userId = this.parsePositiveId(req.params.userId);
    if (!userId) {
      this.sendError(res, 400, "Employee id must be valid");
      return;
    }

    await this.handle(res, "Save payroll settings error", async () => {
      const settings = await this.payrollService.saveSettings(
        userId,
        req.body as PayrollSettingsInput,
      );
      if (!settings) {
        this.sendError(res, 404, "Staff employee not found");
        return;
      }

      res.json({ settings });
    });
  }

  public async calculate(req: Request, res: Response): Promise<void> {
    const period = this.getPeriod(req.body);
    if (!period) {
      this.sendError(res, 400, "Month and year are required");
      return;
    }

    await this.handle(res, "Calculate payroll error", async () => {
      res.json({ summary: await this.payrollService.calculate(period.month, period.year) });
    });
  }

  public async saveCalculatedPayroll(req: Request, res: Response): Promise<void> {
    const period = this.getPeriod(req.body);
    if (!period) {
      this.sendError(res, 400, "Month and year are required");
      return;
    }

    await this.handle(res, "Save payroll error", async () => {
      const summary = await this.payrollService.saveCalculatedPayroll(period.month, period.year);
      res.json({
        message: "Payroll saved.",
        total_employees: summary.total_employees,
        total_net: summary.total_net,
      });
    });
  }

  public async getPeriodPayroll(req: Request, res: Response): Promise<void> {
    const period = this.getPeriod(req.query);
    if (!period) {
      this.sendError(res, 400, "Month and year are required");
      return;
    }

    await this.handle(res, "Get payroll period error", async () => {
      res.json(await this.payrollService.getPeriod(period.month, period.year));
    });
  }

  public async deletePeriodPayroll(req: Request, res: Response): Promise<void> {
    const period = this.getPeriod(req.query);
    if (!period) {
      this.sendError(res, 400, "Month and year are required");
      return;
    }

    await this.handle(res, "Delete payroll period error", async () => {
      const count = await this.payrollService.deletePeriod(period.month, period.year);
      res.json({ message: `Deleted ${count} payroll record(s).` });
    });
  }

  private getPeriod(source: unknown): { month: number; year: number } | null {
    const record = source as { month?: unknown; year?: unknown };
    const month = Number(record.month);
    const year = Number(record.year);

    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
      return null;
    }

    return { month, year };
  }
}
