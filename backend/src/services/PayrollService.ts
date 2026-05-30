import { PayrollSettingsInput, PayrollSummary } from "../models/Payroll";
import { PayrollRepository } from "../repositories/PayrollRepository";

export class PayrollService {
  constructor(private readonly payrollRepository = new PayrollRepository()) {}

  public getSettings(userId: number) {
    return this.payrollRepository.findSettings(userId);
  }

  public saveSettings(userId: number, input: PayrollSettingsInput) {
    return this.payrollRepository.saveSettings(userId, this.normalizeSettings(input));
  }

  public async calculate(month: number, year: number): Promise<PayrollSummary> {
    const calculations = await this.payrollRepository.calculate(month, year);
    return {
      month: new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" }),
      year,
      total_employees: calculations.length,
      calculations,
      total_gross: calculations.reduce((sum, row) => sum + row.gross_salary, 0),
      total_deductions: calculations.reduce((sum, row) => sum + row.deductions, 0),
      total_net: calculations.reduce((sum, row) => sum + row.net_salary, 0),
    };
  }

  public async saveCalculatedPayroll(month: number, year: number) {
    const summary = await this.calculate(month, year);
    await this.payrollRepository.savePayroll(month, year, summary.calculations);
    return summary;
  }

  public async getPeriod(month: number, year: number) {
    const payroll = await this.payrollRepository.findPeriod(month, year);
    return { payroll, month, year, total: payroll.length };
  }

  public async deletePeriod(month: number, year: number): Promise<number> {
    return this.payrollRepository.deletePeriod(month, year);
  }

  private normalizeSettings(input: PayrollSettingsInput): PayrollSettingsInput {
    return {
      base_salary: this.num(input.base_salary),
      housing_allowance: this.num(input.housing_allowance),
      transport_allowance: this.num(input.transport_allowance),
      other_allowances: this.num(input.other_allowances),
      deduction_per_absent_day: this.num(input.deduction_per_absent_day),
      deduction_per_late_day: this.num(input.deduction_per_late_day),
      deduction_per_half_day: this.num(input.deduction_per_half_day),
    };
  }

  private num(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
}
