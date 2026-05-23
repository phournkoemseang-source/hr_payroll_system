type EmployeeRole = "admin" | "staff";
type EmployeeStatus = "active" | "inactive";

interface StoredUser {
  name: string;
  role: EmployeeRole;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string | null;
  salary: number;
  status: EmployeeStatus;
}

interface EmployeeListResponse {
  employees?: Employee[];
  message?: string;
}

interface EmployeeResponse {
  employee?: Employee;
  message?: string;
}

class EmployeesPage {
  private employees: Employee[] = [];
  private readonly userName = this.getElement<HTMLElement>("userName");
  private readonly userRole = this.getElement<HTMLElement>("userRole");
  private readonly logoutButton = this.getElement<HTMLButtonElement>("logoutButton");
  private readonly avatarInitial = this.getElement<HTMLElement>("avatarInitial");
  private readonly openModalButton = this.getElement<HTMLButtonElement>("openAddEmployeeModal");
  private readonly closeModalButton = this.getElement<HTMLButtonElement>("closeAddEmployeeModal");
  private readonly cancelButton = this.getElement<HTMLButtonElement>("cancelAddEmployee");
  private readonly modal = this.getElement<HTMLElement>("addEmployeeModal");
  private readonly form = this.getElement<HTMLFormElement>("addEmployeeForm");
  private readonly submitButton = this.getElement<HTMLButtonElement>("addEmployeeButton");
  private readonly alert = this.getElement<HTMLElement>("addEmployeeAlert");
  private readonly tableBody = this.getElement<HTMLTableSectionElement>("employeeTableBody");
  private readonly employeeCount = this.getElement<HTMLElement>("employeeCount");
  private readonly searchInput = this.getElement<HTMLInputElement>("employeeSearch");
  private readonly departmentFilter = this.getElement<HTMLSelectElement>("departmentFilter");
  private readonly statusFilter = this.getElement<HTMLSelectElement>("statusFilter");
  private readonly employeeIdInput = this.getElement<HTMLInputElement>("employeeId");
  private readonly passwordInput = this.getElement<HTMLInputElement>("employeePassword");
  private readonly modalTitle = this.getElement<HTMLElement>("addEmployeeTitle");

  public init(): void {
    const user = this.getStoredUser();
    if (!user || user.role !== "admin") {
      window.location.href = "/login.html";
      return;
    }

    this.userName.textContent = user.name;
    this.userRole.textContent = "Admin";
    this.avatarInitial.textContent = user.name.charAt(0).toUpperCase();
    this.bindEvents();
    void this.loadEmployees();
  }

  private bindEvents(): void {
    this.logoutButton.addEventListener("click", () => this.logout());
    this.openModalButton.addEventListener("click", () => this.openCreateModal());
    this.closeModalButton.addEventListener("click", () => this.closeModal());
    this.cancelButton.addEventListener("click", () => this.closeModal());
    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal) {
        this.closeModal();
      }
    });
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
    this.tableBody.addEventListener("click", (event) => void this.handleTableClick(event));
    this.searchInput.addEventListener("input", () => this.renderEmployees());
    this.departmentFilter.addEventListener("change", () => this.renderEmployees());
    this.statusFilter.addEventListener("change", () => this.renderEmployees());
  }

  private async loadEmployees(): Promise<void> {
    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    try {
      const response = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        this.logout();
        return;
      }

      const data = (await response.json()) as EmployeeListResponse;
      if (!response.ok) {
        this.renderError(data.message || "Unable to load employees.");
        return;
      }

      this.employees = data.employees || [];
      this.renderEmployees();
    } catch {
      this.renderError("Unable to connect to server.");
    }
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.setAlert("", "");

    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const employeeId = Number(this.employeeIdInput.value || 0);
    const isEditing = employeeId > 0;
    const payload = this.getFormPayload();

    if (!payload.name || !payload.email || !payload.department || !payload.position) {
      this.setAlert("Name, email, department, and position are required.", "error");
      return;
    }

    if (!isEditing && payload.password.length < 6) {
      this.setAlert("Password must be at least 6 characters.", "error");
      return;
    }

    this.submitButton.disabled = true;
    this.submitButton.textContent = isEditing ? "Saving..." : "Creating...";

    try {
      const response = await fetch(
        isEditing ? `/api/employees/${employeeId}` : "/api/employees",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(isEditing ? this.withoutPassword(payload) : payload),
        },
      );
      const data = (await response.json()) as EmployeeResponse;

      if (!response.ok || !data.employee) {
        this.setAlert(data.message || "Unable to save employee.", "error");
        return;
      }

      if (isEditing) {
        this.employees = this.employees.map((employee) =>
          employee.id === data.employee?.id ? data.employee : employee,
        );
      } else {
        this.employees.unshift(data.employee);
      }

      this.renderEmployees();
      this.closeModal();
    } catch {
      this.setAlert("Unable to connect to server.", "error");
    } finally {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "Save Employee";
    }
  }

  private async handleTableClick(event: Event): Promise<void> {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) {
      return;
    }

    const employee = this.findEmployee(button.dataset.id);
    if (!employee) {
      return;
    }

    const action = button.dataset.action;
    if (action === "edit") {
      this.openEditModal(employee);
      return;
    }

    if (action === "toggle-status") {
      await this.saveEmployee({
        ...employee,
        status: employee.status === "active" ? "inactive" : "active",
      });
      return;
    }

    if (action === "delete") {
      await this.deleteEmployee(employee);
    }
  }

  private async saveEmployee(employee: Employee): Promise<void> {
    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(employee),
      });
      const data = (await response.json()) as EmployeeResponse;
      if (!response.ok || !data.employee) {
        window.alert(data.message || "Unable to update employee.");
        return;
      }

      this.employees = this.employees.map((item) =>
        item.id === data.employee?.id ? data.employee : item,
      );
      this.renderEmployees();
    } catch {
      window.alert("Unable to connect to server.");
    }
  }

  private async deleteEmployee(employee: Employee): Promise<void> {
    if (!window.confirm(`Delete ${employee.name}? This removes their staff login too.`)) {
      return;
    }

    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json()) as EmployeeResponse;
        window.alert(data.message || "Unable to delete employee.");
        return;
      }

      this.employees = this.employees.filter((item) => item.id !== employee.id);
      this.renderEmployees();
    } catch {
      window.alert("Unable to connect to server.");
    }
  }

  private renderEmployees(): void {
    const filtered = this.getFilteredEmployees();
    this.employeeCount.textContent = String(this.employees.length);

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `<tr><td colspan="7">No employees found.</td></tr>`;
      return;
    }

    this.tableBody.innerHTML = filtered.map((employee) => this.renderEmployeeRow(employee)).join("");
  }

  private renderEmployeeRow(employee: Employee): string {
    const inactive = employee.status === "inactive";
    return `
      <tr>
        <td>
          <div class="employee">
            <span class="mini-avatar">${this.getInitials(employee.name)}</span>
            <div>
              <strong>${this.escapeHtml(employee.name)}</strong>
              <span>${this.escapeHtml(employee.email)}</span>
            </div>
          </div>
        </td>
        <td>${this.escapeHtml(employee.department)}</td>
        <td>${this.escapeHtml(employee.position)}</td>
        <td>${employee.startDate ? this.formatDate(employee.startDate) : "-"}</td>
        <td>${this.formatMoney(employee.salary)}</td>
        <td><span class="status ${inactive ? "inactive" : ""}">${inactive ? "Inactive" : "Active"}</span></td>
        <td>
          <div class="row-actions">
            <button class="small-btn" data-action="edit" data-id="${employee.id}" type="button">Edit</button>
            <button class="small-btn ${inactive ? "success-btn" : "danger-btn"}" data-action="toggle-status" data-id="${employee.id}" type="button">${inactive ? "Activate" : "Deactivate"}</button>
            <button class="small-btn delete-btn" data-action="delete" data-id="${employee.id}" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  private renderError(message: string): void {
    this.tableBody.innerHTML = `<tr><td colspan="7">${this.escapeHtml(message)}</td></tr>`;
    this.employeeCount.textContent = "0";
  }

  private getFilteredEmployees(): Employee[] {
    const term = this.searchInput.value.trim().toLowerCase();
    const department = this.departmentFilter.value;
    const status = this.statusFilter.value.toLowerCase();

    return this.employees.filter((employee) => {
      const matchesSearch =
        !term ||
        employee.name.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term) ||
        employee.position.toLowerCase().includes(term);
      const matchesDepartment =
        department === "All Departments" || employee.department === department;
      const matchesStatus = status === "all status" || employee.status === status;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }

  private openCreateModal(): void {
    this.form.reset();
    this.employeeIdInput.value = "";
    this.passwordInput.required = true;
    this.passwordInput.disabled = false;
    this.modalTitle.textContent = "Add Employee";
    this.submitButton.textContent = "Create Staff Account";
    this.openModal();
  }

  private openEditModal(employee: Employee): void {
    this.form.reset();
    this.employeeIdInput.value = String(employee.id);
    this.setFormValue("name", employee.name);
    this.setFormValue("email", employee.email);
    this.setFormValue("department", employee.department);
    this.setFormValue("position", employee.position);
    this.setFormValue("salary", String(employee.salary));
    this.setFormValue("startDate", employee.startDate || "");
    this.setFormValue("status", employee.status);
    this.passwordInput.value = "";
    this.passwordInput.required = false;
    this.passwordInput.disabled = true;
    this.modalTitle.textContent = "Edit Employee";
    this.submitButton.textContent = "Save Employee";
    this.openModal();
  }

  private openModal(): void {
    this.modal.classList.add("open");
    this.modal.setAttribute("aria-hidden", "false");
  }

  private closeModal(): void {
    this.modal.classList.remove("open");
    this.modal.setAttribute("aria-hidden", "true");
    this.setAlert("", "");
  }

  private getFormPayload(): {
    name: string;
    email: string;
    password: string;
    department: string;
    position: string;
    salary: string;
    startDate: string;
    status: EmployeeStatus;
  } {
    const formData = new FormData(this.form);
    return {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim().toLowerCase(),
      password: String(formData.get("password") || ""),
      department: String(formData.get("department") || "Operations").trim(),
      position: String(formData.get("position") || "Staff").trim() || "Staff",
      salary: String(formData.get("salary") || "0").trim() || "0",
      startDate: String(formData.get("startDate") || ""),
      status: String(formData.get("status") || "active") as EmployeeStatus,
    };
  }

  private withoutPassword(payload: ReturnType<EmployeesPage["getFormPayload"]>): Omit<
    ReturnType<EmployeesPage["getFormPayload"]>,
    "password"
  > {
    const { password: _password, ...data } = payload;
    return data;
  }

  private findEmployee(id: string | undefined): Employee | null {
    const employeeId = Number(id || 0);
    return this.employees.find((employee) => employee.id === employeeId) || null;
  }

  private setFormValue(name: string, value: string): void {
    const field = this.form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (field) {
      field.value = value;
    }
  }

  private getStoredUser(): StoredUser | null {
    const userJson = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson) as StoredUser;
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

  private getInitials(name: string): string {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  private formatDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  private setAlert(message: string, type: "" | "error" | "success"): void {
    this.alert.textContent = message;
    this.alert.className = type ? `alert ${type}` : "alert";
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

new EmployeesPage().init();
