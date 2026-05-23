type DashboardRole = "admin" | "staff";

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

  public init(): void {
    const expectedRole = document.body.dataset.role as DashboardRole;
    const user = this.getStoredUser();

    if (!user || user.role !== expectedRole) {
      window.location.href = "/login.html";
      return;
    }

    this.userName.textContent = user.name;
    this.userRole.textContent = this.formatRole(user.role);
    this.setOptionalText("welcomeName", user.name);
    this.setOptionalText("avatarInitial", user.name.charAt(0).toUpperCase());
    this.setOptionalText("dashboardDate", this.formatLongDate(new Date()));
    this.logoutButton.addEventListener("click", () => this.logout());
    void this.loadDashboard();
  }

  private async loadDashboard(): Promise<void> {
    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

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
      this.setOptionalText("dashboardStatus", "Unable to connect to server.");
    }
  }

  private renderStats(stats: DashboardStats): void {
    this.setOptionalText("totalEmployees", String(stats.totalEmployees));
    this.setOptionalText(
      "employeesAddedThisMonth",
      `+${stats.employeesAddedThisMonth} this month`,
    );
    this.setOptionalText("presentToday", String(stats.presentToday));
    this.setOptionalText("attendanceRate", `${stats.attendanceRate}%`);
    this.setOptionalText("pendingLeaveRequests", String(stats.pendingLeaveRequests));
    this.setOptionalText("leaveCountBadge", String(stats.pendingLeaveRequests));
    this.setOptionalText("totalPayroll", this.formatMoney(stats.totalPayroll));
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
      .map((day) => {
        const height = Math.max(12, Math.round((day.present / max) * 100));
        const className = day.present > 0 ? "bar" : "bar gray";
        return `
          <div class="bar-wrap">
            <div class="${className}" style="height: ${height}%;">
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
              <button class="approve" type="button" disabled>Approve</button>
              <button class="reject" type="button" disabled>Reject</button>
            </div>
          </div>
        `,
      )
      .join("");
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

  private logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login.html";
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
