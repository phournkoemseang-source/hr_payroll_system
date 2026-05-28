type LeaveRole = "admin" | "staff";
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
type LeaveType = "annual" | "sick" | "personal" | "unpaid" | "maternity" | "paternity";

interface LeaveUser {
  id: number;
  name: string;
  role: LeaveRole;
}

interface LeaveRequestItem {
  id: number;
  userId: number;
  employeeName: string;
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  reviewerName: string | null;
  reviewerNote: string | null;
  createdAt: string;
  canCancel: boolean;
  canReview: boolean;
}

class LeaveRequestPage {
  private readonly role = document.body.dataset.role as LeaveRole;
  private readonly token = this.getStoredToken();
  private readonly user = this.getStoredUser();

  public init(): void {
    if (!this.user || !this.token || this.user.role !== this.role) {
      window.pageTransitions.replace("/login.html", "Opening sign in");
      return;
    }

    this.setText("userName", this.user.name);
    this.setText("userRole", this.user.role);
    this.setText("userInitial", this.initials(this.user.name));
    this.getOptional<HTMLButtonElement>("logoutButton")?.addEventListener("click", () => this.logout());

    if (this.role === "admin") {
      this.bindAdmin();
      void this.loadAdminRequests();
      return;
    }

    this.bindStaff();
    void this.loadStaffRequests();
  }

  private bindStaff(): void {
    const form = this.getElement<HTMLFormElement>("leaveForm");
    const startDate = this.getElement<HTMLInputElement>("startDate");
    const endDate = this.getElement<HTMLInputElement>("endDate");
    const minDate = new Date().toISOString().slice(0, 10);
    startDate.min = minDate;
    endDate.min = minDate;
    form.addEventListener("submit", (event) => void this.submitLeave(event));
  }

  private bindAdmin(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-status-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        void this.loadAdminRequests(button.dataset.statusFilter || "");
      });
    });
  }

  private async submitLeave(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const button = this.getElement<HTMLButtonElement>("submitLeave");
    const payload = {
      leaveType: this.getElement<HTMLSelectElement>("leaveType").value as LeaveType,
      startDate: this.getElement<HTMLInputElement>("startDate").value,
      endDate: this.getElement<HTMLInputElement>("endDate").value,
      reason: this.getElement<HTMLTextAreaElement>("reason").value,
    };

    button.disabled = true;
    button.textContent = "Submitting...";

    try {
      await this.fetchJson<{ message: string; request: LeaveRequestItem }>("/api/leave-requests/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      this.getElement<HTMLFormElement>("leaveForm").reset();
      this.showAlert("Leave request submitted.", "success");
      await this.loadStaffRequests();
    } catch (err) {
      this.showAlert(err instanceof Error ? err.message : "Unable to submit leave request.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Submit Request";
    }
  }

  private async loadStaffRequests(): Promise<void> {
    try {
      const data = await this.fetchJson<{ requests: LeaveRequestItem[] }>("/api/leave-requests/staff");
      this.renderStaffRequests(data.requests);
    } catch (err) {
      this.showAlert(err instanceof Error ? err.message : "Unable to load leave requests.", "error");
    }
  }

  private async loadAdminRequests(status = ""): Promise<void> {
    const url = status ? `/api/leave-requests/admin?status=${encodeURIComponent(status)}` : "/api/leave-requests/admin";
    try {
      const data = await this.fetchJson<{ requests: LeaveRequestItem[] }>(url);
      this.renderAdminRequests(data.requests);
      this.setText("allCount", String(data.requests.length));
      const pendingCount = data.requests.filter((request) => request.status === "pending").length;
      this.setText("pendingCount", String(pendingCount));
      this.setText("leaveCountBadge", String(pendingCount));
      this.setText("approvedCount", String(data.requests.filter((request) => request.status === "approved").length));
      this.setText("rejectedCount", String(data.requests.filter((request) => request.status === "rejected").length));
    } catch (err) {
      this.showAlert(err instanceof Error ? err.message : "Unable to load leave requests.", "error");
    }
  }

  private renderStaffRequests(requests: LeaveRequestItem[]): void {
    const body = this.getElement<HTMLTableSectionElement>("leaveHistoryBody");
    if (requests.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No leave requests yet.</td></tr>';
      return;
    }

    body.innerHTML = requests.map((request) => `
      <tr>
        <td>${this.label(request.leaveType)}</td>
        <td>${this.dateRange(request)}</td>
        <td>${request.totalDays}</td>
        <td><span class="status ${request.status}">${this.label(request.status)}</span></td>
        <td>${this.escapeHtml(request.status === "rejected" ? request.reviewerNote || "-" : request.reason)}</td>
        <td>${request.canCancel ? `<button class="btn danger" data-cancel-id="${request.id}" type="button">Cancel</button>` : "-"}</td>
      </tr>
    `).join("");

    body.querySelectorAll<HTMLButtonElement>("[data-cancel-id]").forEach((button) => {
      button.addEventListener("click", () => void this.cancelRequest(button.dataset.cancelId || ""));
    });
  }

  private renderAdminRequests(requests: LeaveRequestItem[]): void {
    const body = this.getElement<HTMLTableSectionElement>("adminLeaveBody");
    if (requests.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty">No leave requests for this filter.</td></tr>';
      return;
    }

    body.innerHTML = requests.map((request) => `
      <tr>
        <td><strong>${this.escapeHtml(request.employeeName)}</strong><p class="muted">${this.escapeHtml(request.employeeEmail)}</p></td>
        <td>${this.label(request.leaveType)}</td>
        <td>${this.formatDate(request.startDate)}</td>
        <td>${this.formatDate(request.endDate)}</td>
        <td>${request.totalDays}</td>
        <td>${this.escapeHtml(request.reason)}</td>
        <td><span class="status ${request.status}">${this.label(request.status)}</span></td>
        <td>${request.canReview ? this.adminActions(request.id) : "-"}</td>
      </tr>
    `).join("");

    body.querySelectorAll<HTMLButtonElement>("[data-approve-id]").forEach((button) => {
      button.addEventListener("click", () => void this.reviewRequest(button.dataset.approveId || "", "approve"));
    });
    body.querySelectorAll<HTMLButtonElement>("[data-reject-id]").forEach((button) => {
      button.addEventListener("click", () => void this.reviewRequest(button.dataset.rejectId || "", "reject"));
    });
  }

  private async cancelRequest(id: string): Promise<void> {
    try {
      await this.fetchJson(`/api/leave-requests/staff/${id}/cancel`, { method: "PATCH" });
      this.showAlert("Leave request cancelled.", "success");
      await this.loadStaffRequests();
    } catch (err) {
      this.showAlert(err instanceof Error ? err.message : "Unable to cancel request.", "error");
    }
  }

  private async reviewRequest(id: string, action: "approve" | "reject"): Promise<void> {
    const note = action === "reject" ? window.prompt("Reason for rejection") || "" : "";
    if (action === "reject" && note.trim().length < 3) {
      this.showAlert("A rejection reason is required.", "error");
      return;
    }

    try {
      await this.fetchJson(`/api/leave-requests/admin/${id}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ note }),
      });
      this.showAlert(`Leave request ${action === "approve" ? "approved" : "rejected"}.`, "success");
      const activeFilter = document.querySelector<HTMLElement>("[data-status-filter].active")?.dataset.statusFilter || "";
      await this.loadAdminRequests(activeFilter);
    } catch (err) {
      this.showAlert(err instanceof Error ? err.message : `Unable to ${action} request.`, "error");
    }
  }

  private adminActions(id: number): string {
    return `
      <div class="actions">
        <button class="btn approve" data-approve-id="${id}" type="button">Approve</button>
        <button class="btn danger" data-reject-id="${id}" type="button">Reject</button>
      </div>
    `;
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      this.logout();
      throw new Error("Authentication required");
    }
    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }
    return data as T;
  }

  private dateRange(request: LeaveRequestItem): string {
    return request.startDate === request.endDate
      ? this.formatDate(request.startDate)
      : `${this.formatDate(request.startDate)} - ${this.formatDate(request.endDate)}`;
  }

  private formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }

  private label(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private showAlert(message: string, type: "error" | "success"): void {
    const alert = this.getElement<HTMLElement>("leaveAlert");
    alert.textContent = message;
    alert.className = `alert ${type}`;
  }

  private setText(id: string, value: string): void {
    const element = this.getOptional<HTMLElement>(id);
    if (element) {
      element.textContent = value;
    }
  }

  private getStoredUser(): LeaveUser | null {
    const userJson = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!userJson) {
      return null;
    }
    try {
      return JSON.parse(userJson) as LeaveUser;
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

  private initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return entities[char];
    });
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required element: ${id}`);
    }
    return element as T;
  }

  private getOptional<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }
}

new LeaveRequestPage().init();
