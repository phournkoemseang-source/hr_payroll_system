export interface PayrollSettings {
  id: number;
  user_id: number;
  base_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  deduction_per_absent_day: number;
  deduction_per_late_day: number;
  deduction_per_half_day: number;
}

export interface PayrollSettingsInput {
  base_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  deduction_per_absent_day: number;
  deduction_per_late_day: number;
  deduction_per_half_day: number;
}

export interface PayrollCalculation {
  employee_id: number;
  employee_name: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
}

export interface PayrollSummary {
  month: string;
  year: number;
  total_employees: number;
  calculations: PayrollCalculation[];
  total_gross: number;
  total_deductions: number;
  total_net: number;
}
