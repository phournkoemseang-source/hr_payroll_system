type DashboardRole = "admin" | "staff";
type AttendanceStatus = "present" | "absent" | "late" | "on_leave";

interface DashboardUser {
  id?: number;
  name: string;
  role: DashboardRole;
}

interface DashboardStats {
  totalEmployees: number;
  employeesAddedThisMonth: number;
  presentToday: number;
  attendanceRate: number;
  pendingLeaveRequests: number;
  totalPayroll: number;
}

interface AttendanceDay {
  label: string;
  date: string;
  present: number;
  absent: number;
}

interface AttendanceEmployee {
  id: number;
  name: string;
  email: string;
  role: DashboardRole;
  department: string;
}

interface AttendanceRecord {
  id: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  attendanceDate: string;
  status: AttendanceStatus;
  note: string | null;
  updatedAt: string;
}

interface AttendanceSummaryRow {
  userId: number;
  employeeName: string;
  employeeEmail: string;
  department: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  totalMarked: number;
  attendanceRate: number;
}

interface AttendanceDashboard {
  date: string;
  month: number;
  year: number;
  employees: AttendanceEmployee[];
  dayRecords: AttendanceRecord[];
  summary: AttendanceSummaryRow[];
  departments: string[];
  totals: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    attendanceRate: number;
  };
}

interface StaffAttendanceHistory {
  month: number;
  year: number;
  records: AttendanceRecord[];
  totals: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    attendanceRate: number;
  };
}

interface PendingLeaveRequest {
  id: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

interface RecentEmployee {
  id: number;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string | null;
  salary: number;
  status: string;
}

interface StaffDashboardSummary {
  profile: {
    department: string;
    position: string;
    startDate: string | null;
    salary: number;
    status: string;
  } | null;
  todayAttendance: string | null;
  pendingLeaveRequests: number;
  latestPayroll: number;
}

interface DashboardResponse {
  stats: DashboardStats;
  attendanceWeek: AttendanceDay[];
  pendingLeaves: PendingLeaveRequest[];
  recentEmployees: RecentEmployee[];
  staff?: StaffDashboardSummary;
}

class DashboardPage {
  private readonly userName = this.getElement<HTMLElement>("userName");
  private readonly userRole = this.getElement<HTMLElement>("userRole");
  private readonly logoutButton = this.getElement<HTMLButtonElement>("logoutButton");
  private readonly page = document.body.dataset.page || "dashboard";
  private dashboardRefreshTimer: number | null = null;
  private dashboardLoading = false;

  public init(): void {
    const expectedRole = document.body.dataset.role as DashboardRole;
    const user = this.getStoredUser();

    if (!user || user.role !== expectedRole) {
      window.pageTransitions.replace("/login.html", "Opening sign in");
      return;
    }

    this.userName.textContent = user.name;
    this.userRole.textContent = this.formatRole(user.role);
    this.setOptionalText("welcomeName", user.name);
    this.setOptionalText("avatarInitial", user.name.charAt(0).toUpperCase());
    this.setOptionalText("dashboardDate", this.formatLongDate(new Date()));
    this.logoutButton.addEventListener("click", () => this.logout());
    document.getElementById("runPayrollButton")?.addEventListener("click", () => {
      window.pageTransitions.navigate("/admin/payroll.html", "Opening payroll");
    });
    if (this.page !== "dashboard") {
      void this.loadPendingLeaveBadge();
    }

    if (this.page === "attendance-admin") {
      void this.initializeAdminAttendance();
      return;
    }

    if (this.page === "attendance-staff") {
      void this.initializeStaffAttendance();
      return;
    }

    void this.loadDashboard();
    if (expectedRole === "admin") {
      this.dashboardRefreshTimer = window.setInterval(() => void this.loadDashboard(true), 30000);
      window.addEventListener("beforeunload", () => {
        if (this.dashboardRefreshTimer !== null) {
          window.clearInterval(this.dashboardRefreshTimer);
        }
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          void this.loadDashboard(true);
        }
      });
    }
  }

  private async loadDashboard(silent = false): Promise<void> {
    if (this.dashboardLoading) {
      return;
    }

    const token = this.getStoredToken();
    if (!token) {
      window.pageTransitions.replace("/login.html", "Opening sign in");
      return;
    }

    this.dashboardLoading = true;
    try {
      const response = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        this.logout();
        return;
      }

      const data = (await response.json()) as DashboardResponse;
      if (!response.ok) {
        this.setOptionalText("dashboardStatus", "Unable to load dashboard data.");
        return;
      }

      this.renderStats(data.stats);
      this.renderAttendance(data.attendanceWeek);
      this.renderLeaves(data.pendingLeaves);
      this.renderEmployees(data.recentEmployees);
      this.renderStaffSummary(data.staff);
      this.setOptionalText("dashboardStatus", "Live from MySQL");
    } catch {
      if (!silent) {
        this.setOptionalText("dashboardStatus", "Unable to connect to server.");
      }
    } finally {
      this.dashboardLoading = false;
    }
  }

  private renderStats(stats: DashboardStats): void {
    this.animateNumber("totalEmployees", stats.totalEmployees);
    this.setOptionalText(
      "employeesAddedThisMonth",
      `+${stats.employeesAddedThisMonth} this month`,
    );
    this.animateNumber("presentToday", stats.presentToday);
    this.animateNumber("attendanceRate", stats.attendanceRate, (value) => `${value}%`);
    this.animateNumber("pendingLeaveRequests", stats.pendingLeaveRequests);
    this.setBadgeText("leaveCountBadge", stats.pendingLeaveRequests);
    this.animateNumber("totalPayroll", stats.totalPayroll, (value) => this.formatMoney(value));
    this.setOptionalText(
      "payrollMonth",
      new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    );
  }

  private renderAttendance(days: AttendanceDay[]): void {
    const chart = document.getElementById("attendanceChart");
    if (!chart) {
      return;
    }

    const max = Math.max(...days.map((day) => day.present + day.absent), 1);
    chart.innerHTML = days
      .map((day, index) => {
        const height = Math.max(12, Math.round((day.present / max) * 100));
        const className = day.present > 0 ? "bar" : "bar gray";
        return `
          <div class="bar-wrap">
            <div class="${className}" style="--bar-height: ${height}%; animation-delay: ${index * 80}ms;">
              <span>${day.present}</span>
            </div>
            <div class="day">${this.escapeHtml(day.label)}</div>
          </div>
        `;
      })
      .join("");
  }

  private renderLeaves(leaves: PendingLeaveRequest[]): void {
    const list = document.getElementById("pendingLeaveList");
    if (!list) {
      return;
    }

    if (leaves.length === 0) {
      list.innerHTML = `<div class="empty-state">No pending leave requests.</div>`;
      return;
    }

    list.innerHTML = leaves
      .map(
        (leave) => `
          <div class="leave-item">
            <div class="leave-info">
              <strong>${this.escapeHtml(leave.employeeName)}</strong>
              <span>${this.escapeHtml(leave.leaveType)} - ${this.formatDateRange(leave.startDate, leave.endDate)}</span>
            </div>
            <div class="leave-actions">
              <button class="approve" data-id="${leave.id}" type="button">Approve</button>
              <button class="reject" data-id="${leave.id}" type="button">Reject</button>
            </div>
          </div>
        `,
      )
      .join("");

    list.querySelectorAll<HTMLButtonElement>(".approve").forEach((btn) => {
      btn.addEventListener("click", () => this.reviewLeave(Number(btn.dataset.id), "approve"));
    });
    list.querySelectorAll<HTMLButtonElement>(".reject").forEach((btn) => {
      btn.addEventListener("click", () => this.reviewLeave(Number(btn.dataset.id), "reject"));
    });
  }

  private async reviewLeave(id: number, action: "approve" | "reject"): Promise<void> {
    try {
      await this.fetchJson(`/api/leave-requests/admin/${id}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "" }),
      });
      void this.loadDashboard(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  private renderEmployees(employees: RecentEmployee[]): void {
    const tableBody = document.getElementById("recentEmployeesBody");
    if (!tableBody) {
      return;
    }

    if (employees.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6">No staff employees found yet.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = employees
      .map(
        (employee) => `
          <tr>
            <td><div class="employee"><span class="mini-avatar">${this.getInitials(employee.name)}</span>${this.escapeHtml(employee.name)}</div></td>
            <td>${this.escapeHtml(employee.department)}</td>
            <td>${this.escapeHtml(employee.position)}</td>
            <td>${employee.startDate ? this.formatShortDate(employee.startDate) : "-"}</td>
            <td>${this.formatMoney(employee.salary)}</td>
            <td><span class="status">${this.escapeHtml(this.capitalize(employee.status))}</span></td>
          </tr>
        `,
      )
      .join("");
  }

  private renderStaffSummary(staff: StaffDashboardSummary | undefined): void {
    if (!staff) {
      return;
    }

    this.setOptionalText("staffDepartment", staff.profile?.department || "-");
    this.setOptionalText("staffPosition", staff.profile?.position || "-");
    this.setOptionalText(
      "staffAttendance",
      staff.todayAttendance ? this.capitalize(staff.todayAttendance) : "Not checked in",
    );
    this.setOptionalText("staffPendingLeaves", String(staff.pendingLeaveRequests));
    this.setOptionalText("staffLatestPayroll", this.formatMoney(staff.latestPayroll));
  }

  private async loadPendingLeaveBadge(): Promise<void> {
    if (document.body.dataset.role !== "admin" || !document.getElementById("leaveCountBadge")) {
      return;
    }

    try {
      const data = await this.fetchJson<DashboardResponse>("/api/dashboard");
      this.setBadgeText("leaveCountBadge", data.stats.pendingLeaveRequests);
    } catch {
      this.setBadgeText("leaveCountBadge", 0);
    }
  }

  private async initializeAdminAttendance(): Promise<void> {
    const dateInput = this.getElement<HTMLInputElement>("attendanceDate");
    const monthInput = this.getElement<HTMLInputElement>("summaryMonth");
    const departmentFilter = this.getElement<HTMLSelectElement>("departmentFilter");
    const saveButton = this.getElement<HTMLButtonElement>("saveAttendance");
    const exportButton = this.getElement<HTMLButtonElement>("exportAttendance");
    const today = new Date();

    dateInput.value = this.toDateInput(today);
    monthInput.value = this.toMonthInput(today);
    dateInput.addEventListener("change", () => void this.loadAdminAttendance());
    monthInput.addEventListener("change", () => void this.loadAdminAttendance());
    departmentFilter.addEventListener("change", () => void this.loadAdminAttendance());
    saveButton.addEventListener("click", () => void this.saveAttendance());
    exportButton.addEventListener("click", () => this.exportAttendanceSummary());

    await this.loadAdminAttendance();
  }

  private async loadAdminAttendance(): Promise<void> {
    const dateInput = this.getElement<HTMLInputElement>("attendanceDate");
    const monthInput = this.getElement<HTMLInputElement>("summaryMonth");
    const departmentFilter = this.getElement<HTMLSelectElement>("departmentFilter");
    const [year, month] = monthInput.value.split("-").map(Number);
    const params = new URLSearchParams({
      date: dateInput.value,
      month: String(month),
      year: String(year),
    });

    if (departmentFilter.value) {
      params.set("department", departmentFilter.value);
    }

    try {
      const dashboard = await this.fetchJson<AttendanceDashboard>(`/api/attendance/admin/dashboard?${params}`);
      this.renderDepartmentFilter(dashboard.departments, departmentFilter.value);
      this.renderMarkList(dashboard);
      this.renderAdminAttendanceTotals(dashboard);
      this.renderAttendanceSummary(dashboard.summary);
      this.setOptionalText("calendarTitle", `${this.monthName(month)} ${year} - Daily Attendance`);
      this.setOptionalText("todayTitle", this.formatShortDate(dateInput.value));
      this.setOptionalText("summaryTitle", `All Employee Attendance - ${this.monthName(month)} ${year}`);
      this.setAttendanceAlert("", "");
    } catch (err) {
      this.setAttendanceAlert(err instanceof Error ? err.message : "Unable to load attendance.", "error");
    }
  }

  private renderDepartmentFilter(departments: string[], selected: string): void {
    const departmentFilter = this.getElement<HTMLSelectElement>("departmentFilter");
    departmentFilter.innerHTML = [
      '<option value="">All departments</option>',
      ...departments.map((department) => `<option value="${this.escapeHtml(department)}">${this.escapeHtml(department)}</option>`),
    ].join("");
    departmentFilter.value = selected;
  }

  private renderMarkList(dashboard: AttendanceDashboard): void {
    const markList = this.getElement<HTMLElement>("markList");
    const statusByUser = new Map(dashboard.dayRecords.map((record) => [record.userId, record.status]));
    const noteByUser = new Map(dashboard.dayRecords.map((record) => [record.userId, record.note || ""]));

    if (dashboard.employees.length === 0) {
      markList.innerHTML = '<p class="empty">No staff employees found.</p>';
      return;
    }

    markList.innerHTML = "";
    for (const employee of dashboard.employees) {
      const row = document.createElement("div");
      const selectedStatus = statusByUser.get(employee.id) || "present";
      row.className = "mark-row";
      row.innerHTML = `
        <div class="employee">
          <span class="mini">${this.getInitials(employee.name)}</span>
          <div>
            <strong>${this.escapeHtml(employee.name)}</strong>
            <p class="muted">${this.escapeHtml(employee.department)} - ${this.escapeHtml(employee.email)}</p>
          </div>
        </div>
        <select class="select attendance-status" data-user-id="${employee.id}" data-note="${this.escapeHtml(noteByUser.get(employee.id) || "")}">
          ${this.statusOption("present", selectedStatus)}
          ${this.statusOption("absent", selectedStatus)}
          ${this.statusOption("late", selectedStatus)}
          ${this.statusOption("on_leave", selectedStatus)}
        </select>
      `;
      markList.appendChild(row);
    }
  }

  private renderAdminAttendanceTotals(dashboard: AttendanceDashboard): void {
    this.setOptionalText("presentCount", String(dashboard.totals.present));
    this.setOptionalText("absentCount", String(dashboard.totals.absent));
    this.setOptionalText("lateCount", String(dashboard.totals.late));
    this.setOptionalText("leaveCount", String(dashboard.totals.onLeave));
    this.setOptionalText("attendanceRate", `${dashboard.totals.attendanceRate}%`);
    this.getElement<HTMLElement>("attendanceBar").style.width = `${dashboard.totals.attendanceRate}%`;
  }

  private renderAttendanceSummary(summary: AttendanceSummaryRow[]): void {
    const body = this.getElement<HTMLTableSectionElement>("summaryBody");
    if (summary.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No attendance records for this filter.</td></tr>';
      return;
    }

    body.innerHTML = summary
      .map(
        (row) => `
          <tr>
            <td><div class="employee"><span class="mini">${this.getInitials(row.employeeName)}</span>${this.escapeHtml(row.employeeName)}</div></td>
            <td>${this.escapeHtml(row.department)}</td>
            <td>${row.present}</td>
            <td>${row.absent}</td>
            <td>${row.late}</td>
            <td>${row.onLeave}</td>
            <td class="${row.attendanceRate >= 90 ? "rate-good" : "rate-warn"}">${row.attendanceRate}%</td>
          </tr>
        `,
      )
      .join("");
  }

  private async saveAttendance(): Promise<void> {
    const saveButton = this.getElement<HTMLButtonElement>("saveAttendance");
    const date = this.getElement<HTMLInputElement>("attendanceDate").value;
    const records = Array.from(document.querySelectorAll<HTMLSelectElement>(".attendance-status")).map((select) => ({
      userId: Number(select.dataset.userId),
      status: select.value as AttendanceStatus,
      note: select.dataset.note || "",
    }));

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      await this.fetchJson<{ message: string }>("/api/attendance/admin/mark", {
        method: "POST",
        body: JSON.stringify({ date, records }),
      });
      this.setAttendanceAlert("Attendance saved.", "success");
      await this.loadAdminAttendance();
    } catch (err) {
      this.setAttendanceAlert(err instanceof Error ? err.message : "Unable to save attendance.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Attendance";
    }
  }

  private exportAttendanceSummary(): void {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("#summaryBody tr"));
    const lines = [["Employee", "Department", "Present", "Absent", "Late", "On Leave", "Rate"]];
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => `"${cell.textContent?.trim().replace(/"/g, '""') || ""}"`);
      if (cells.length === 7) {
        lines.push(cells);
      }
    }

    const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-report-${this.getElement<HTMLInputElement>("summaryMonth").value}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private async initializeStaffAttendance(): Promise<void> {
    const monthInput = this.getElement<HTMLInputElement>("staffMonth");
    monthInput.value = this.toMonthInput(new Date());
    monthInput.addEventListener("change", () => void this.loadStaffAttendance());
    await this.loadStaffAttendance();
  }

  private async loadStaffAttendance(): Promise<void> {
    const monthInput = this.getElement<HTMLInputElement>("staffMonth");
    const [year, month] = monthInput.value.split("-").map(Number);
    try {
      const history = await this.fetchJson<StaffAttendanceHistory>(`/api/attendance/staff/history?month=${month}&year=${year}`);
      this.setOptionalText("staffSummaryTitle", `Monthly Summary - ${this.monthName(month)} ${year}`);
      this.setOptionalText("staffPresentCount", String(history.totals.present));
      this.setOptionalText("staffAbsentCount", String(history.totals.absent));
      this.setOptionalText("staffLateCount", String(history.totals.late));
      this.setOptionalText("staffLeaveCount", String(history.totals.onLeave));
      this.setOptionalText("staffAttendanceRate", `${history.totals.attendanceRate}%`);
      this.getElement<HTMLElement>("staffAttendanceBar").style.width = `${history.totals.attendanceRate}%`;
      this.renderStaffAttendanceHistory(history.records);
    } catch {
      this.renderStaffAttendanceHistory([]);
    }
  }

  private renderStaffAttendanceHistory(records: AttendanceRecord[]): void {
    const body = this.getElement<HTMLTableSectionElement>("staffHistoryBody");
    if (records.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No attendance records for this month yet.</td></tr>';
      return;
    }

    body.innerHTML = records
      .map(
        (record) => `
          <tr>
            <td>${this.formatShortDate(record.attendanceDate)}</td>
            <td><span class="status ${record.status}">${record.status.replace("_", " ")}</span></td>
            <td>${this.escapeHtml(record.note || "-")}</td>
            <td>${this.formatDateTime(record.updatedAt)}</td>
          </tr>
        `,
      )
      .join("");
  }

  private getStoredUser(): DashboardUser | null {
    const userJson = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson) as DashboardUser;
    } catch {
      return null;
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
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

    if (response.status === 401 || response.status === 403) {
      this.logout();
      throw new Error("Authentication required");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Request failed");
    }

    return data as T;
  }

  private logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.pageTransitions.navigate("/login.html", "Signing out");
  }

  private formatRole(role: DashboardRole): string {
    return role === "admin" ? "Admin" : "Staff";
  }

  private setOptionalText(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  private setBadgeText(id: string, count: number): void {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    element.textContent = String(count);
    element.hidden = count <= 0;
  }

  private animateNumber(
    id: string,
    target: number,
    formatter: (value: number) => string = (value) => String(value),
  ): void {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = formatter(Math.round(target));
      element.dataset.value = String(target);
      return;
    }

    const start = Number(element.dataset.value ?? element.textContent?.replace(/[^0-9.-]/g, "") ?? 0) || 0;
    const end = Number(target) || 0;
    const duration = 850;
    const startedAt = performance.now();

    element.classList.remove("is-counting");
    void element.offsetWidth;
    element.classList.add("is-counting");

    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = start + (end - start) * eased;
      element.textContent = formatter(Math.round(value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      element.textContent = formatter(Math.round(end));
      element.dataset.value = String(end);
      element.classList.remove("is-counting");
    };

    window.requestAnimationFrame(step);
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatLongDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  private formatShortDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  private toDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toMonthInput(date: Date): string {
    return date.toISOString().slice(0, 7);
  }

  private monthName(month: number): string {
    return new Date(2000, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  }

  private formatDateRange(startDate: string, endDate: string): string {
    const start = this.formatShortDate(startDate);
    const end = this.formatShortDate(endDate);
    return start === end ? start : `${start} - ${end}`;
  }

  private getInitials(name: string): string {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private statusOption(status: AttendanceStatus, selected?: AttendanceStatus): string {
    const label = this.capitalize(status.replace("_", " "));
    return `<option value="${status}" ${selected === status ? "selected" : ""}>${label}</option>`;
  }

  private setAttendanceAlert(message: string, type: "" | "error" | "success"): void {
    const alert = document.getElementById("attendanceAlert");
    if (!alert) {
      return;
    }

    alert.textContent = message;
    alert.className = type ? `alert ${type}` : "alert";
  }

  private escapeHtml(value: string): string {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required element: ${id}`);
    }
    return element as T;
  }
}

new DashboardPage().init();
