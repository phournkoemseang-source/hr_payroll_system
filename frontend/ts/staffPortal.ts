interface StaffUser {
  id: number;
  name: string;
  role: "staff";
}

interface StaffDashboardData {
  stats: {
    totalEmployees: number;
    employeesAddedThisMonth: number;
    presentToday: number;
    attendanceRate: number;
    pendingLeaveRequests: number;
    totalPayroll: number;
  };
  staff?: {
    profile: any;
    todayAttendance: string | null;
    pendingLeaveRequests: number;
    latestPayroll: number;
  };
  attendanceWeek: any[];
}

class StaffPortal {
  private readonly token = localStorage.getItem("token") || sessionStorage.getItem("token");
  private readonly user = this.getStoredUser();
  private readonly page = document.body.dataset.page;

  public async init(): Promise<void> {
    if (!this.token || !this.user || this.user.role !== "staff") {
      window.pageTransitions.replace("/login.html", "Session expired");
      return;
    }

    this.setupCommonUI();

    switch (this.page) {
      case "dashboard":
        await this.loadDashboard();
        break;
      case "profile":
        await this.loadProfile();
        break;
      case "attendance":
        await this.loadAttendance();
        break;
      case "payslip":
        await this.loadPayslip();
        break;
    }
  }

  private setupCommonUI(): void {
    this.setText("userName", this.user!.name);
    this.setText("sidebarName", this.user!.name);
    this.getEl<HTMLButtonElement>("logoutButton")?.addEventListener("click", () => this.logout());
    
    // Initial avatar setup
    this.updateAvatars(null, this.user!.name);
  }

  private updateAvatars(photo: string | null, name: string): void {
    const initial = name.charAt(0).toUpperCase();
    const avatarIds = ["avatarInitial", "profileInitial", "photoPreview"];
    
    avatarIds.forEach(id => {
      const el = this.getEl(id);
      if (!el) return;
      
      if (photo) {
        el.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
      } else {
        el.textContent = initial;
      }
    });
  }

  private async loadDashboard(): Promise<void> {
    try {
      const data = await this.fetchJson<StaffDashboardData>("/api/dashboard");
      this.setText("dashboardDate", new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      
      if (data.staff && data.staff.profile) {
        this.updateAvatars(data.staff.profile.profilePhoto, data.staff.profile.name);
        this.setText("daysPresent", String(data.stats.presentToday));
        this.setText("attendanceRateText", `${data.stats.attendanceRate}% attendance rate`);
        
        const annualRemaining = data.staff.profile.annualLeaveBalance;
        const sickRemaining = data.staff.profile.sickLeaveBalance;

        this.setText("leaveRemaining", String(annualRemaining));
        this.setText("leaveUsedText", `${18 - annualRemaining} used`);
        
        this.setText("latestPayslip", this.formatMoney(data.staff.latestPayroll));
        this.setText("latestPayslipStatus", data.staff.latestPayroll > 0 ? "Paid" : "Draft");
        
        this.setText("pendingLeaves", String(data.staff.pendingLeaveRequests));
        this.setText("pendingLeaveCaption", data.staff.pendingLeaveRequests > 0 ? "Awaiting review" : "No pending requests");

        this.renderLeaveBars(annualRemaining, sickRemaining);
        
        // Notification logic
        this.updateNotificationBadge(data.staff.pendingLeaveRequests);
      }

      this.renderMiniCalendar(data.attendanceWeek);
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  }

  private updateNotificationBadge(count: number): void {
    const bell = this.getEl("notificationButton");
    if (!bell) return;
    
    let badge = bell.querySelector(".notification-badge") as HTMLElement;
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notification-badge";
      // Basic styling for the badge
      Object.assign(badge.style, {
        position: 'absolute',
        top: '10px',
        right: '10px',
        width: '18px',
        height: '18px',
        background: '#ef4444',
        color: '#fff',
        borderRadius: '50%',
        fontSize: '11px',
        fontWeight: '800',
        display: 'grid',
        placeItems: 'center',
        border: '2px solid #fff'
      });
      bell.style.position = 'relative';
      bell.appendChild(badge);
    }
    
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "grid" : "none";
  }

  private renderLeaveBars(annual: number, sick: number): void {
    this.setText("annualText", `${annual} days left`);
    const annualBar = this.getEl("annualBar");
    if (annualBar) annualBar.style.width = `${(annual / 18) * 100}%`;

    this.setText("sickText", `${sick} days left`);
    const sickBar = this.getEl("sickBar");
    if (sickBar) sickBar.style.width = `${(sick / 6) * 100}%`;
  }

  private async loadProfile(): Promise<void> {
    try {
      const data = await this.fetchJson<any>("/api/dashboard");
      const profile = data.staff?.profile;
      if (!profile) return;

      this.setText("profileName", profile.name);
      this.setText("profileInitial", profile.name.charAt(0).toUpperCase());
      this.setText("employeeId", profile.employeeId);
      this.setText("fullName", profile.name);
      this.setText("email", profile.email);
      this.setText("phone", profile.phoneNumber || "Not set");
      this.setText("address", profile.address || "Not set");
      this.setText("dob", profile.dateOfBirth || "Not set");
      this.setText("position", profile.position);
      this.setText("department", profile.department);
      this.setText("startDate", profile.startDate || "Not set");

      this.setupProfileEditing(profile);
    } catch (err) {
      console.error("Profile load failed", err);
    }
  }

  private setupProfileEditing(profile: any): void {
    const modal = this.getEl("editProfileModal");
    const form = this.getEl<HTMLFormElement>("editProfileForm");
    const photoInput = form?.querySelector<HTMLInputElement>('input[name="profilePhotoFile"]');
    const photoPreview = this.getEl("photoPreview");
    let base64Photo: string | null = profile.profilePhoto || null;

    if (photoPreview && base64Photo) {
      photoPreview.innerHTML = `<img src="${base64Photo}" alt="Profile">`;
    }
    
    this.getEl("editProfileBtn")?.addEventListener("click", () => {
      modal?.classList.add("active");
      this.setFormValue(form, "name", profile.name);
      this.setFormValue(form, "phoneNumber", profile.phoneNumber || "");
      this.setFormValue(form, "address", profile.address || "");
      this.setFormValue(form, "dateOfBirth", profile.dateOfBirth || "");
    });

    this.getEl("closeModalBtn")?.addEventListener("click", () => modal?.classList.remove("active"));
    this.getEl("cancelEditBtn")?.addEventListener("click", () => modal?.classList.remove("active"));

    photoInput?.addEventListener("change", async () => {
      const file = photoInput.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be under 2MB");
        photoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        base64Photo = e.target?.result as string;
        if (photoPreview) {
          photoPreview.innerHTML = `<img src="${base64Photo}" alt="Profile">`;
        }
      };
      reader.readAsDataURL(file);
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        ...Object.fromEntries(new FormData(form).entries()),
        profilePhoto: base64Photo
      };
      delete (payload as any).profilePhotoFile;

      const btn = this.getEl<HTMLButtonElement>("saveProfileBtn");
      if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }

      try {
        await this.fetchJson("/api/employees/profile", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        location.reload();
      } catch (err) {
        this.setText("profileAlert", "Update failed. Please check your connection.");
        this.getEl("profileAlert")?.classList.add("success"); // Reuse class for layout
        this.getEl("profileAlert")!.style.display = "block";
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Save Changes"; }
      }
    });
  }

  private async loadAttendance(): Promise<void> {
    const monthInput = this.getEl<HTMLInputElement>("attendanceMonth");
    if (!monthInput) return;
    
    const now = new Date();
    monthInput.value = now.toISOString().slice(0, 7);

    const fetchAttendance = async () => {
      const [year, month] = monthInput.value.split("-");
      try {
        const data = await this.fetchJson<any>(`/api/attendance/staff/history?month=${month}&year=${year}`);
        this.renderAttendanceTable(data.records);
        this.setText("presentCount", String(data.totals.present));
        this.setText("absentCount", String(data.totals.absent));
        this.setText("lateCount", String(data.totals.late));
        this.setText("onLeaveCount", String(data.totals.onLeave));
      } catch (err) {
        this.renderAttendanceTable([]);
      }
    };

    monthInput.addEventListener("change", fetchAttendance);
    void fetchAttendance();
  }

  private renderAttendanceTable(records: any[]): void {
    const body = this.getEl("attendanceBody");
    if (!body) return;
    if (records.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No records found for this month.</td></tr>';
      return;
    }
    body.innerHTML = records.map(r => `
      <tr>
        <td>${this.formatDate(r.attendanceDate)}</td>
        <td>${new Date(r.attendanceDate).toLocaleDateString("en-US", { weekday: "long" })}</td>
        <td><span class="status ${r.status}">${r.status.replace('_', ' ')}</span></td>
        <td>${r.note || "-"}</td>
      </tr>
    `).join("");
  }

  private async loadPayslip(): Promise<void> {
    const monthInput = this.getEl<HTMLInputElement>("payslipMonth");
    if (!monthInput) return;

    const now = new Date();
    monthInput.value = now.toISOString().slice(0, 7);

    const fetchPayslip = async () => {
      const [year, month] = monthInput.value.split("-");
      try {
        const data = await this.fetchJson<any>(`/api/payroll/staff/payslip?month=${month}&year=${year}`);
        this.renderPayslip(data.payslip);
        this.renderPayslipHistory(data.history);
      } catch (err) {
        console.error("Payslip load failed", err);
      }
    };

    monthInput.addEventListener("change", fetchPayslip);
    this.getEl("downloadPayslip")?.addEventListener("click", () => window.print());
    void fetchPayslip();
  }

  private renderPayslip(slip: any): void {
    if (!slip) {
      this.setText("payslipSub", "No payslip found for this period");
      return;
    }

    this.setText("payslipSub", `${slip.month} ${slip.year} Period`);
    this.setText("payslipEmployee", slip.employeeName);
    this.setText("payslipPosition", slip.position);
    this.setText("baseSalary", this.formatMoney(slip.baseSalary));
    this.setText("housingAllowance", `+$${slip.housingAllowance.toFixed(2)}`);
    this.setText("transportAllowance", `+$${slip.transportAllowance.toFixed(2)}`);
    this.setText("absenceDeduction", `-$${slip.absenceDeduction.toFixed(2)}`);
    this.setText("taxDeduction", `-$${slip.taxDeduction.toFixed(2)}`);
    this.setText("netPay", this.formatMoney(slip.netPay));
  }

  private renderPayslipHistory(history: any[]): void {
    const body = this.getEl("payslipHistoryBody");
    if (!body) return;
    if (!history || history.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No history available.</td></tr>';
      return;
    }
    body.innerHTML = history.map(h => `
      <tr>
        <td>${h.month} ${h.year}</td>
        <td>${this.formatMoney(h.grossPay)}</td>
        <td class="danger">${this.formatMoney(h.deductions)}</td>
        <td class="primary-text">${this.formatMoney(h.netPay)}</td>
        <td><span class="status">${h.status}</span></td>
      </tr>
    `).join("");
  }

  private renderMiniCalendar(days: any[]): void {
    const cal = this.getEl("miniCalendar");
    if (!cal) return;
    
    // Add header
    let html = "<b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>";
    
    // Determine starting empty spaces for the month (Monday start)
    const firstDate = new Date(days[0]?.date || new Date());
    let startDay = firstDate.getDay(); // 0 is Sunday
    startDay = startDay === 0 ? 6 : startDay - 1; // Adjust to 0=Mon, 6=Sun
    
    for (let i = 0; i < startDay; i++) {
      html += '<span class="empty-day"></span>';
    }

    html += days.map((d, index) => {
      let status = "empty";
      if (d.isHoliday) status = "on_leave holiday";
      else if (d.present > 0) status = "present";
      else if (d.absent > 0) status = "absent";
      
      const title = d.isHoliday ? d.label : "";
      return `<span class="${status}" title="${title}" style="--day-delay: ${index * 15}ms">${new Date(d.date).getDate()}</span>`;
    }).join("");
    
    cal.innerHTML = html;
  }

  private formatDate(v: string): string {
    return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...init.headers,
      },
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  }

  private getStoredUser(): StaffUser | null {
    const s = localStorage.getItem("user") || sessionStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  }

  private setText(id: string, val: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  private getEl<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T;
  }

  private setFormValue(form: HTMLFormElement | null, name: string, val: string): void {
    if (!form) return;
    const input = form.elements.namedItem(name) as HTMLInputElement;
    if (input) input.value = val;
  }

  private formatMoney(v: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  }

  private logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    window.pageTransitions.navigate("/login.html", "Signing out");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StaffPortal().init();
});
