import { RowDataPacket } from "mysql2";
import {
  PayrollCalculation,
  PayrollSettings,
  PayrollSettingsInput,
  StaffPayslip,
  StaffPayslipHistoryItem,
} from "../models/Payroll";
import { SchemaRepository } from "./SchemaRepository";

interface PayrollEmployeeRow extends RowDataPacket {
  id: number;
  name: string;
  salary: number | string;
  base_salary: number | string | null;
  housing_allowance: number | string | null;
  transport_allowance: number | string | null;
  other_allowances: number | string | null;
  deduction_per_absent_day: number | string | null;
  deduction_per_late_day: number | string | null;
  deduction_per_half_day: number | string | null;
  absent_days: number | string;
  late_days: number | string;
  half_days: number | string;
}

interface StaffPayrollRow extends RowDataPacket {
  id: number | null;
  user_id: number;
  name: string;
  employee_id: string;
  position: string;
  pay_period: string | null;
  base_salary: number | string | null;
  profile_salary: number | string | null;
  housing_allowance: number | string | null;
  transport_allowance: number | string | null;
  other_allowances: number | string | null;
  deductions: number | string | null;
  gross_pay: number | string | null;
  net_pay: number | string | null;
  status: string | null;
}

export class PayrollRepository extends SchemaRepository {
  public async staffExists(userId: number): Promise<boolean> {
    const rows = await this.query<RowDataPacket[]>(
      `
        SELECT u.id
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        WHERE u.id = ? AND u.role = 'staff'
        LIMIT 1
      `,
      [userId],
    );
    return rows.length > 0;
  }

  public async findSettings(userId: number): Promise<PayrollSettings | null> {
    const rows = await this.query<RowDataPacket[]>(
      "SELECT * FROM payroll_settings WHERE user_id = ? LIMIT 1",
      [userId],
    );
    return rows.length > 0 ? this.toSettings(rows[0]) : null;
  }

  public async saveSettings(userId: number, input: PayrollSettingsInput): Promise<PayrollSettings> {
    await this.transaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO payroll_settings
            (user_id, base_salary, housing_allowance, transport_allowance, other_allowances,
             deduction_per_absent_day, deduction_per_late_day, deduction_per_half_day)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            base_salary = VALUES(base_salary),
            housing_allowance = VALUES(housing_allowance),
            transport_allowance = VALUES(transport_allowance),
            other_allowances = VALUES(other_allowances),
            deduction_per_absent_day = VALUES(deduction_per_absent_day),
            deduction_per_late_day = VALUES(deduction_per_late_day),
            deduction_per_half_day = VALUES(deduction_per_half_day)
        `,
        [
          userId,
          input.base_salary,
          input.housing_allowance,
          input.transport_allowance,
          input.other_allowances,
          input.deduction_per_absent_day,
          input.deduction_per_late_day,
          input.deduction_per_half_day,
        ],
      );

      await connection.execute(
        "UPDATE employees SET base_salary = ? WHERE user_id = ?",
        [input.base_salary, userId],
      );
    });

    return (await this.findSettings(userId)) as PayrollSettings;
  }

  public async calculate(month: number, year: number): Promise<PayrollCalculation[]> {
    const start = this.periodStart(month, year);
    const end = this.periodEnd(month, year);
    const rows = await this.query<PayrollEmployeeRow[]>(
      `
        SELECT u.id,
          u.name,
          e.base_salary AS salary,
          ps.base_salary,
          ps.housing_allowance,
          ps.transport_allowance,
          ps.other_allowances,
          ps.deduction_per_absent_day,
          ps.deduction_per_late_day,
          ps.deduction_per_half_day,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
          SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS late_days,
          SUM(CASE WHEN ar.status = 'on_leave' THEN 1 ELSE 0 END) AS half_days
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        LEFT JOIN payroll_settings ps ON ps.user_id = u.id
        LEFT JOIN attendance_records ar
          ON ar.user_id = u.id
          AND ar.work_date BETWEEN ? AND ?
        WHERE u.role = 'staff' AND e.status = 'active'
        GROUP BY u.id, u.name, e.base_salary, ps.base_salary, ps.housing_allowance,
          ps.transport_allowance, ps.other_allowances, ps.deduction_per_absent_day,
          ps.deduction_per_late_day, ps.deduction_per_half_day
        ORDER BY u.name
      `,
      [start, end],
    );

    return rows.map((row) => {
      const baseSalary = Number(row.base_salary ?? row.salary ?? 0);
      const allowances =
        Number(row.housing_allowance || 0) +
        Number(row.transport_allowance || 0) +
        Number(row.other_allowances || 0);
      const deductions =
        Number(row.absent_days || 0) * Number(row.deduction_per_absent_day || 0) +
        Number(row.late_days || 0) * Number(row.deduction_per_late_day || 0) +
        Number(row.half_days || 0) * Number(row.deduction_per_half_day || 0);
      const grossSalary = baseSalary + allowances;

      return {
        employee_id: Number(row.id),
        employee_name: row.name,
        base_salary: baseSalary,
        allowances,
        deductions,
        gross_salary: grossSalary,
        net_salary: Math.max(0, grossSalary - deductions),
      };
    });
  }

  public async savePayroll(month: number, year: number, calculations: PayrollCalculation[]): Promise<void> {
    const payPeriod = this.periodStart(month, year);

    await this.transaction(async (connection) => {
      for (const row of calculations) {
        await connection.execute(
          `
            INSERT INTO payroll_records
              (user_id, pay_period, base_salary, allowances, deductions, gross_pay, net_pay, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
            ON DUPLICATE KEY UPDATE
              base_salary = VALUES(base_salary),
              allowances = VALUES(allowances),
              deductions = VALUES(deductions),
              gross_pay = VALUES(gross_pay),
              net_pay = VALUES(net_pay),
              status = 'paid'
          `,
          [
            row.employee_id,
            payPeriod,
            row.base_salary,
            row.allowances,
            row.deductions,
            row.gross_salary,
            row.net_salary,
          ],
        );
      }
    });
  }

  public async findPeriod(month: number, year: number): Promise<RowDataPacket[]> {
    return this.query<RowDataPacket[]>(
      `
        SELECT pr.id,
          CONCAT('EMP', LPAD(u.id, 3, '0')) AS employee_id,
          SUBSTRING_INDEX(u.name, ' ', 1) AS first_name,
          TRIM(SUBSTRING(u.name, LENGTH(SUBSTRING_INDEX(u.name, ' ', 1)) + 1)) AS last_name,
          DATE_FORMAT(pr.pay_period, '%Y-%m-%d') AS pay_period_start,
          LAST_DAY(pr.pay_period) AS pay_period_end,
          pr.base_salary AS basic_salary,
          pr.allowances,
          pr.deductions,
          pr.gross_pay AS gross_salary,
          pr.net_pay AS net_salary,
          pr.status,
          pr.created_at
        FROM payroll_records pr
        INNER JOIN users u ON u.id = pr.user_id
        WHERE YEAR(pr.pay_period) = ? AND MONTH(pr.pay_period) = ?
        ORDER BY u.name
      `,
      [year, month],
    );
  }

  public async findStaffPayslip(
    userId: number,
    month: number,
    year: number,
  ): Promise<StaffPayslip | null> {
    const rows = await this.query<StaffPayrollRow[]>(
      `
        SELECT pr.id,
          u.id AS user_id,
          u.name,
          CONCAT('EMP-', LPAD(u.id, 4, '0')) AS employee_id,
          e.position,
          DATE_FORMAT(pr.pay_period, '%Y-%m-%d') AS pay_period,
          pr.base_salary,
          e.base_salary AS profile_salary,
          ps.housing_allowance,
          ps.transport_allowance,
          ps.other_allowances,
          pr.deductions,
          pr.gross_pay,
          pr.net_pay,
          pr.status
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        LEFT JOIN payroll_records pr
          ON pr.user_id = u.id
          AND YEAR(pr.pay_period) = ?
          AND MONTH(pr.pay_period) = ?
        LEFT JOIN payroll_settings ps ON ps.user_id = u.id
        WHERE u.id = ? AND u.role = 'staff'
        LIMIT 1
      `,
      [year, month, userId],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const baseSalary = Number(row.base_salary ?? row.profile_salary ?? 0);
    const housingAllowance = Number(row.housing_allowance || 0);
    const transportAllowance = Number(row.transport_allowance || 0);
    const otherAllowances = Number(row.other_allowances || 0);
    const savedGross = Number(row.gross_pay || 0);
    const grossPay = savedGross || baseSalary + housingAllowance + transportAllowance + otherAllowances;
    const deductions = Number(row.deductions || 0);
    const savedNet = Number(row.net_pay || 0);

    return {
      id: row.id ? Number(row.id) : null,
      employeeId: row.employee_id,
      employeeName: row.name,
      position: row.position,
      month: new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" }),
      year,
      baseSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      grossPay,
      absenceDeduction: deductions,
      taxDeduction: 0,
      deductions,
      netPay: savedNet || Math.max(0, grossPay - deductions),
      status: row.status || "draft",
    };
  }

  public async findStaffPayslipHistory(userId: number): Promise<StaffPayslipHistoryItem[]> {
    const rows = await this.query<RowDataPacket[]>(
      `
        SELECT id,
          MONTHNAME(pay_period) AS month,
          YEAR(pay_period) AS year,
          gross_pay AS grossPay,
          deductions,
          net_pay AS netPay,
          status
        FROM payroll_records
        WHERE user_id = ?
        ORDER BY pay_period DESC, id DESC
        LIMIT 12
      `,
      [userId],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      month: String(row.month),
      year: Number(row.year),
      grossPay: Number(row.grossPay || 0),
      deductions: Number(row.deductions || 0),
      netPay: Number(row.netPay || 0),
      status: String(row.status || "draft"),
    }));
  }

  public async deletePeriod(month: number, year: number): Promise<number> {
    const result = await this.execute(
      "DELETE FROM payroll_records WHERE YEAR(pay_period) = ? AND MONTH(pay_period) = ?",
      [year, month],
    );
    return result.affectedRows;
  }

  private toSettings(row: RowDataPacket): PayrollSettings {
    return {
      id: Number(row.id),
      user_id: Number(row.user_id),
      base_salary: Number(row.base_salary || 0),
      housing_allowance: Number(row.housing_allowance || 0),
      transport_allowance: Number(row.transport_allowance || 0),
      other_allowances: Number(row.other_allowances || 0),
      deduction_per_absent_day: Number(row.deduction_per_absent_day || 0),
      deduction_per_late_day: Number(row.deduction_per_late_day || 0),
      deduction_per_half_day: Number(row.deduction_per_half_day || 0),
    };
  }

  private periodStart(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  private periodEnd(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  }
}
