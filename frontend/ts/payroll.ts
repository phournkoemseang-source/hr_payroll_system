type PayrollUserRole = "admin" | "staff";

interface PayrollStoredUser {
  id?: number;
  name: string;
  role: PayrollUserRole;
}

interface PayrollEmployeeRecord {
  id: number;
  name: string;
  salary: number;
  status: string;
}

interface PayrollSettingsRecord {
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

interface PayrollCalculation {
  employee_id: number;
  employee_name: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
}

interface SavedPayrollRecord {
  employee_id: string;
  first_name: string;
  last_name: string;
  basic_salary: number | string;
  allowances: number | string;
  deductions: number | string;
  gross_salary: number | string;
  net_salary: number | string;
  status: string;
}

interface PayrollSummary {
  month: string;
  year: number;
  total_employees: number;
  calculations: PayrollCalculation[];
  total_gross: number;
  total_deductions: number;
  total_net: number;
}

class AdminPayrollPage {
  private readonly userName = this.getEl<HTMLElement>("userName");
  private readonly userRole = this.getEl<HTMLElement>("userRole");
  private readonly avatarInitial = this.getEl<HTMLElement>("avatarInitial");
  private readonly logoutButton = this.getEl<HTMLButtonElement>("logoutButton");
  private readonly payrollSearch = this.getEl<HTMLInputElement>("payrollSearch");
  private readonly payrollStatus = this.getEl<HTMLElement>("payrollStatus");
  private readonly employeeSelect = this.getEl<HTMLSelectElement>("employeeSelect");
  private readonly baseSalary = this.getEl<HTMLInputElement>("baseSalary");
  private readonly housingAllowance = this.getEl<HTMLInputElement>("housingAllowance");
  private readonly transportAllowance = this.getEl<HTMLInputElement>("transportAllowance");
  private readonly otherAllowances = this.getEl<HTMLInputElement>("otherAllowances");
  private readonly dedAbsent = this.getEl<HTMLInputElement>("dedAbsent");
  private readonly dedLate = this.getEl<HTMLInputElement>("dedLate");
  private readonly dedHalfDay = this.getEl<HTMLInputElement>("dedHalfDay");
  private readonly saveSettingsBtn = this.getEl<HTMLButtonElement>("saveSettingsBtn");
  private readonly resetSettingsBtn = this.getEl<HTMLButtonElement>("resetSettingsBtn");
  private readonly settingsMsg = this.getEl<HTMLElement>("settingsMsg");
  private readonly monthSelect = this.getEl<HTMLSelectElement>("monthSelect");
  private readonly yearInput = this.getEl<HTMLInputElement>("yearInput");
  private readonly previewPayrollBtn = this.getEl<HTMLButtonElement>("previewPayrollBtn");
  private readonly previewPayrollSecondaryBtn = this.getEl<HTMLButtonElement>("previewPayrollSecondaryBtn");
  private readonly savePayrollBtn = this.getEl<HTMLButtonElement>("savePayrollBtn");
  private readonly exportPreviewBtn = this.getEl<HTMLButtonElement>("exportPreviewBtn");
  private readonly payrollSummaryMsg = this.getEl<HTMLElement>("payrollSummaryMsg");
  private readonly payrollTableWrap = this.getEl<HTMLElement>("payrollTableWrap");
  private readonly previewGross = this.getEl<HTMLElement>("previewGross");
  private readonly previewDeductions = this.getEl<HTMLElement>("previewDeductions");
  private readonly previewNet = this.getEl<HTMLElement>("previewNet");
  private readonly periodMonthSelect = this.getEl<HTMLSelectElement>("periodMonthSelect");
  private readonly periodYearInput = this.getEl<HTMLInputElement>("periodYearInput");
  private readonly loadPeriodBtn = this.getEl<HTMLButtonElement>("loadPeriodBtn");
  private readonly deletePeriodBtn = this.getEl<HTMLButtonElement>("deletePeriodBtn");
  private readonly exportPeriodBtn = this.getEl<HTMLButtonElement>("exportPeriodBtn");
  private readonly periodMsg = this.getEl<HTMLElement>("periodMsg");
  private readonly periodTableWrap = this.getEl<HTMLElement>("periodTableWrap");
  private employees: PayrollEmployeeRecord[] = [];
  private lastPreview: { month: number; year: number; summary: PayrollSummary } | null = null;
  private lastPeriodRows: SavedPayrollRecord[] = [];

  public init(): void {
    const user = this.getStoredUser();
    if (!user || user.role !== "admin") {
      window.pageTransitions.replace("/login.html", "Opening sign in");
      return;
    }

    this.userName.textContent = user.name;
    this.userRole.textContent = "Admin";
    this.avatarInitial.textContent = user.name.charAt(0).toUpperCase();
    this.logoutButton.addEventListener("click", () => this.logout());
    this.populateMonthSelect(this.monthSelect);
    this.populateMonthSelect(this.periodMonthSelect);

    const now = new Date();
    this.monthSelect.value = String(now.getMonth() + 1);
    this.periodMonthSelect.value = String(now.getMonth() + 1);
    this.yearInput.value = String(now.getFullYear());
    this.periodYearInput.value = String(now.getFullYear());

    this.employeeSelect.addEventListener("change", () => void this.loadEmployeeSettings());
    this.saveSettingsBtn.addEventListener("click", () => void this.saveEmployeeSettings());
    this.resetSettingsBtn.addEventListener("click", () => void this.loadEmployeeSettings());
    this.previewPayrollBtn.addEventListener("click", () => void this.previewPayroll());
    this.previewPayrollSecondaryBtn.addEventListener("click", () => void this.previewPayroll());
    this.savePayrollBtn.addEventListener("click", () => void this.savePayroll());
    this.exportPreviewBtn.addEventListener("click", () => this.exportPreview());
    this.loadPeriodBtn.addEventListener("click", () => void this.loadPeriod());
    this.deletePeriodBtn.addEventListener("click", () => void this.deletePeriod());
    this.exportPeriodBtn.addEventListener("click", () => this.exportPeriod());
    this.payrollSearch.addEventListener("input", () => {
      this.renderPayrollPreview(this.lastPreview?.summary.calculations || []);
      this.renderPeriod(this.lastPeriodRows);
    });

    void this.loadPendingLeaveBadge();
    void this.loadEmployees();
  }

  private async loadEmployees(): Promise<void> {
    try {
      const result = await this.fetchJson<{ employees: PayrollEmployeeRecord[] }>("/api/employees");
      this.employees = (result.employees || []).filter((employee) => employee.status === "active");
      if (this.employees.length === 0) {
        this.employeeSelect.innerHTML = `<option value="">No employees found</option>`;
        this.setAlert(this.settingsMsg, "No active employees available.", "error");
        return;
      }

      this.employeeSelect.innerHTML = this.employees
        .map((employee) => `<option value="${employee.id}">${this.employeeCode(employee.id)} - ${this.escape(employee.name)}</option>`)
        .join("");
      await this.loadEmployeeSettings();
      this.payrollStatus.textContent = `${this.employees.length} active employee(s) ready for payroll`;
    } catch {
      this.employeeSelect.innerHTML = `<option value="">Failed to load employees</option>`;
      this.setAlert(this.settingsMsg, "Failed to load employees.", "error");
      this.payrollStatus.textContent = "Unable to load payroll employees";
    }
  }

  private async loadEmployeeSettings(): Promise<void> {
    const employeeId = Number(this.employeeSelect.value);
    if (!employeeId) return;
    const employee = this.employees.find((item) => item.id === employeeId) || null;
    this.setAlert(this.settingsMsg, "Loading settings...", "");

    try {
      const res = await this.fetchJson<{ settings: PayrollSettingsRecord }>(`/api/payroll/settings/${employeeId}`);
      this.fillSettingsForm(res.settings);
      this.setAlert(this.settingsMsg, "Settings loaded.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("404")) {
        this.fillSettingsForm({
          id: 0,
          user_id: employeeId,
          base_salary: employee?.salary ?? 0,
          housing_allowance: 0,
          transport_allowance: 0,
          other_allowances: 0,
          deduction_per_absent_day: 0,
          deduction_per_late_day: 0,
          deduction_per_half_day: 0,
        });
        this.setAlert(this.settingsMsg, "No settings yet. Fill and save.", "");
      } else {
        this.setAlert(this.settingsMsg, "Failed to load settings.", "error");
      }
    }
  }

  private fillSettingsForm(settings: PayrollSettingsRecord): void {
    this.baseSalary.value = String(settings.base_salary ?? 0);
    this.housingAllowance.value = String(settings.housing_allowance ?? 0);
    this.transportAllowance.value = String(settings.transport_allowance ?? 0);
    this.otherAllowances.value = String(settings.other_allowances ?? 0);
    this.dedAbsent.value = String(settings.deduction_per_absent_day ?? 0);
    this.dedLate.value = String(settings.deduction_per_late_day ?? 0);
    this.dedHalfDay.value = String(settings.deduction_per_half_day ?? 0);
  }

  private async saveEmployeeSettings(): Promise<void> {
    const employeeId = Number(this.employeeSelect.value);
    if (!employeeId) return;
    const payload = {
      base_salary: this.num(this.baseSalary.value),
      housing_allowance: this.num(this.housingAllowance.value),
      transport_allowance: this.num(this.transportAllowance.value),
      other_allowances: this.num(this.otherAllowances.value),
      deduction_per_absent_day: this.num(this.dedAbsent.value),
      deduction_per_late_day: this.num(this.dedLate.value),
      deduction_per_half_day: this.num(this.dedHalfDay.value),
    };

    if (payload.base_salary <= 0) {
      this.setAlert(this.settingsMsg, "Base salary must be greater than 0.", "error");
      return;
    }

    this.saveSettingsBtn.disabled = true;
    this.setAlert(this.settingsMsg, "Saving...", "");
    try {
      await this.fetchJson(`/api/payroll/settings/${employeeId}`, { method: "PUT", body: JSON.stringify(payload) });
      this.setAlert(this.settingsMsg, "Settings saved.", "success");
    } catch (err) {
      this.setAlert(this.settingsMsg, err instanceof Error ? err.message : "Failed to save settings.", "error");
    } finally {
      this.saveSettingsBtn.disabled = false;
    }
  }

  private async previewPayroll(): Promise<void> {
    const month = Number(this.monthSelect.value);
    const year = Number(this.yearInput.value);
    this.savePayrollBtn.disabled = true;
    this.exportPreviewBtn.disabled = true;
    this.lastPreview = null;
    this.setPreviewTotals(null);
    this.payrollSummaryMsg.className = "muted";
    this.payrollSummaryMsg.textContent = "Calculating...";
    this.payrollTableWrap.innerHTML = `<p class="empty">Loading...</p>`;

    try {
      const res = await this.fetchJson<{ summary: PayrollSummary }>("/api/payroll/calculate", {
        method: "POST",
        body: JSON.stringify({ month, year }),
      });
      this.lastPreview = { month, year, summary: res.summary };
      this.savePayrollBtn.disabled = false;
      this.exportPreviewBtn.disabled = res.summary.calculations.length === 0;
      this.payrollSummaryMsg.textContent = `${res.summary.month} ${res.summary.year}: ${res.summary.total_employees} employees - Net total ${this.money(res.summary.total_net)}`;
      this.setPreviewTotals(res.summary);
      this.renderPayrollPreview(res.summary.calculations);
    } catch (err) {
      this.payrollSummaryMsg.className = "error";
      this.payrollSummaryMsg.textContent = err instanceof Error ? err.message : "Failed to calculate payroll.";
      this.payrollTableWrap.innerHTML = `<p class="empty">No data.</p>`;
    }
  }

  private renderPayrollPreview(rows: PayrollCalculation[]): void {
    const filtered = this.filterPreviewRows(rows);
    if (filtered.length === 0) {
      this.payrollTableWrap.innerHTML = `<p class="empty">${rows.length === 0 ? "No employees calculated." : "No payroll rows match your search."}</p>`;
      return;
    }

    this.payrollTableWrap.innerHTML = `
      <table class="table">
        <thead><tr><th>Employee</th><th class="right">Base</th><th class="right">Allowances</th><th class="right">Deductions</th><th class="right">Gross</th><th class="right">Net</th></tr></thead>
        <tbody>${filtered.map((row) => `
          <tr>
            <td><div class="employee"><span class="mini-avatar">${this.getInitials(row.employee_name)}</span>${this.escape(row.employee_name)} (${this.employeeCode(row.employee_id)})</div></td>
            <td class="right">${this.money(row.base_salary)}</td>
            <td class="right">${this.money(row.allowances)}</td>
            <td class="right">${this.money(row.deductions)}</td>
            <td class="right">${this.money(row.gross_salary)}</td>
            <td class="right"><strong>${this.money(row.net_salary)}</strong></td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  private async savePayroll(): Promise<void> {
    if (!this.lastPreview) return;
    this.savePayrollBtn.disabled = true;
    this.payrollSummaryMsg.className = "muted";
    this.payrollSummaryMsg.textContent = "Saving payroll...";
    try {
      const res = await this.fetchJson<{ message: string; total_employees: number; total_net: number }>("/api/payroll/calculate/save", {
        method: "POST",
        body: JSON.stringify({ month: this.lastPreview.month, year: this.lastPreview.year }),
      });
      this.payrollSummaryMsg.className = "success";
      this.payrollSummaryMsg.textContent = `${res.message} ${res.total_employees} employees, net total ${this.money(res.total_net)}.`;
      this.periodMonthSelect.value = String(this.lastPreview.month);
      this.periodYearInput.value = String(this.lastPreview.year);
      await this.loadPeriod();
    } catch (err) {
      this.payrollSummaryMsg.className = "error";
      this.payrollSummaryMsg.textContent = err instanceof Error ? err.message : "Failed to save payroll.";
      this.savePayrollBtn.disabled = false;
    }
  }

  private async loadPeriod(): Promise<void> {
    const month = Number(this.periodMonthSelect.value);
    const year = Number(this.periodYearInput.value);
    this.periodMsg.className = "muted";
    this.periodMsg.textContent = "Loading period...";
    this.lastPeriodRows = [];
    this.exportPeriodBtn.disabled = true;
    try {
      const res = await this.fetchJson<{ payroll: SavedPayrollRecord[]; total: number }>(`/api/payroll/period?month=${month}&year=${year}`);
      this.lastPeriodRows = res.payroll || [];
      this.exportPeriodBtn.disabled = this.lastPeriodRows.length === 0;
      this.periodMsg.textContent = `Loaded ${res.total} payroll records for ${month}/${year}.`;
      this.renderPeriod(this.lastPeriodRows);
    } catch (err) {
      this.periodMsg.className = "error";
      this.periodMsg.textContent = err instanceof Error ? err.message : "Failed to load period.";
      this.periodTableWrap.innerHTML = `<p class="empty">No data.</p>`;
    }
  }

  private renderPeriod(rows: SavedPayrollRecord[]): void {
    const filtered = this.filterPeriodRows(rows);
    if (filtered.length === 0) {
      this.periodTableWrap.innerHTML = `<p class="empty">${rows.length === 0 ? "No payroll found for this period." : "No saved payroll rows match your search."}</p>`;
      return;
    }

    this.periodTableWrap.innerHTML = `
      <table class="table">
        <thead><tr><th>Employee</th><th>Status</th><th class="right">Base</th><th class="right">Allowances</th><th class="right">Deductions</th><th class="right">Gross</th><th class="right">Net</th></tr></thead>
        <tbody>${filtered.map((row) => {
          const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
          return `
          <tr>
            <td><div class="employee"><span class="mini-avatar">${this.getInitials(name || `${row.employee_id}`)}</span>${this.escape(`${row.employee_id ?? ""}`)} - ${this.escape(name)}</div></td>
            <td><span class="pill">${this.escape(row.status || "paid")}</span></td>
            <td class="right">${this.money(Number(row.basic_salary || 0))}</td>
            <td class="right">${this.money(Number(row.allowances || 0))}</td>
            <td class="right">${this.money(Number(row.deductions || 0))}</td>
            <td class="right">${this.money(Number(row.gross_salary || 0))}</td>
            <td class="right"><strong>${this.money(Number(row.net_salary || 0))}</strong></td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;
  }

  private async deletePeriod(): Promise<void> {
    const month = Number(this.periodMonthSelect.value);
    const year = Number(this.periodYearInput.value);
    if (!window.confirm(`Delete payroll for ${month}/${year}?`)) return;
    this.periodMsg.className = "muted";
    this.periodMsg.textContent = "Deleting period...";
    try {
      const res = await this.fetchJson<{ message: string }>(`/api/payroll/period?month=${month}&year=${year}`, { method: "DELETE" });
      this.periodMsg.className = "success";
      this.periodMsg.textContent = res.message;
      this.lastPeriodRows = [];
      this.exportPeriodBtn.disabled = true;
      this.periodTableWrap.innerHTML = `<p class="empty">No period loaded.</p>`;
    } catch (err) {
      this.periodMsg.className = "error";
      this.periodMsg.textContent = err instanceof Error ? err.message : "Failed to delete period.";
    }
  }

  private async loadPendingLeaveBadge(): Promise<void> {
    const badge = document.getElementById("leaveCountBadge");
    if (!badge) return;

    try {
      const data = await this.fetchJson<{ stats?: { pendingLeaveRequests?: number } }>("/api/dashboard");
      badge.textContent = String(data.stats?.pendingLeaveRequests || 0);
    } catch {
      badge.textContent = "0";
    }
  }

  private setPreviewTotals(summary: PayrollSummary | null): void {
    this.previewGross.textContent = this.money(summary?.total_gross || 0);
    this.previewDeductions.textContent = this.money(summary?.total_deductions || 0);
    this.previewNet.textContent = this.money(summary?.total_net || 0);
  }

  private filterPreviewRows(rows: PayrollCalculation[]): PayrollCalculation[] {
    const term = this.payrollSearch.value.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.employee_name} ${this.employeeCode(row.employee_id)}`.toLowerCase().includes(term),
    );
  }

  private filterPeriodRows(rows: SavedPayrollRecord[]): SavedPayrollRecord[] {
    const term = this.payrollSearch.value.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.employee_id} ${row.first_name} ${row.last_name} ${row.status}`.toLowerCase().includes(term),
    );
  }

  private exportPreview(): void {
    if (!this.lastPreview) return;
    const rows = this.filterPreviewRows(this.lastPreview.summary.calculations).map((row) => [
      this.employeeCode(row.employee_id),
      row.employee_name,
      row.base_salary,
      row.allowances,
      row.deductions,
      row.gross_salary,
      row.net_salary,
    ]);
    this.downloadCsv(`payroll-preview-${this.lastPreview.year}-${String(this.lastPreview.month).padStart(2, "0")}.csv`, [
      ["Employee ID", "Employee", "Base", "Allowances", "Deductions", "Gross", "Net"],
      ...rows,
    ]);
  }

  private exportPeriod(): void {
    const month = Number(this.periodMonthSelect.value);
    const year = Number(this.periodYearInput.value);
    const rows = this.filterPeriodRows(this.lastPeriodRows).map((row) => [
      row.employee_id,
      `${row.first_name} ${row.last_name}`.trim(),
      row.status,
      row.basic_salary,
      row.allowances,
      row.deductions,
      row.gross_salary,
      row.net_salary,
    ]);
    this.downloadCsv(`payroll-period-${year}-${String(month).padStart(2, "0")}.csv`, [
      ["Employee ID", "Employee", "Status", "Base", "Allowances", "Deductions", "Gross", "Net"],
      ...rows,
    ]);
  }

  private downloadCsv(filename: string, rows: unknown[][]): void {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private populateMonthSelect(select: HTMLSelectElement): void {
    select.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const name = new Date(2000, index, 1).toLocaleString("en-US", { month: "long" });
      return `<option value="${month}">${name}</option>`;
    }).join("");
  }

  private async fetchJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
    const token = this.getStoredToken();
    if (!token) {
      this.logout();
      throw new Error("Authentication required");
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (response.status === 401 || response.status === 403) {
      this.logout();
      throw new Error("Authentication required");
    }
    if (!response.ok) {
      throw new Error(data?.message || "Request failed");
    }
    return data as T;
  }

  private getStoredUser(): PayrollStoredUser | null {
    const value = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!value) return null;
    try {
      return JSON.parse(value) as PayrollStoredUser;
    } catch {
      return null;
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  }

  private logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.pageTransitions.navigate("/login.html", "Signing out");
  }

  private num(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private money(value: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  private getInitials(name: string): string {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  private setAlert(element: HTMLElement, message: string, type: "" | "error" | "success"): void {
    element.textContent = message;
    element.className = type ? `alert show ${type}` : "alert show";
  }

  private employeeCode(id: number): string {
    return `EMP${String(id).padStart(3, "0")}`;
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
  }

  private getEl<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element: ${id}`);
    return element as T;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new AdminPayrollPage().init();
});
