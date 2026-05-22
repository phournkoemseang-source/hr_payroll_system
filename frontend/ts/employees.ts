type EmployeeRole = "admin" | "staff";

interface StoredUser {
  name: string;
  role: EmployeeRole;
}

interface CreateStaffResponse {
  message?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: EmployeeRole;
  };
}

class EmployeesPage {
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
    this.updateEmployeeCount();
  }

  private bindEvents(): void {
    this.logoutButton.addEventListener("click", () => this.logout());
    this.openModalButton.addEventListener("click", () => this.openModal());
    this.closeModalButton.addEventListener("click", () => this.closeModal());
    this.cancelButton.addEventListener("click", () => this.closeModal());
    this.modal.addEventListener("click", (event) => {
      if (event.target === this.modal) {
        this.closeModal();
      }
    });
    this.form.addEventListener("submit", (event) => void this.handleSubmit(event));
    this.searchInput.addEventListener("input", () => this.filterEmployees());
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.setAlert("", "");

    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const formData = new FormData(this.form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const department = String(formData.get("department") || "Operations");
    const position = String(formData.get("position") || "Staff").trim() || "Staff";
    const salary = String(formData.get("salary") || "$0").trim() || "$0";
    const startDate = String(formData.get("startDate") || "");

    if (!name || !email || !password) {
      this.setAlert("Name, email, and password are required.", "error");
      return;
    }

    if (password.length < 6) {
      this.setAlert("Password must be at least 6 characters.", "error");
      return;
    }

    this.submitButton.disabled = true;
    this.submitButton.textContent = "Creating...";

    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role: "staff" }),
      });
      const data = (await response.json()) as CreateStaffResponse;

      if (!response.ok) {
        this.setAlert(data.message || "Unable to create staff account.", "error");
        return;
      }

      this.addEmployeeRow({
        name: data.user?.name || name,
        email: data.user?.email || email,
        department,
        position,
        salary,
        startDate,
      });
      this.form.reset();
      this.setAlert(`${name} can now log in with ${email}.`, "success");
      this.updateEmployeeCount();
    } catch {
      this.setAlert("Unable to connect to server.", "error");
    } finally {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "Create Staff Account";
    }
  }

  private addEmployeeRow(employee: {
    name: string;
    email: string;
    department: string;
    position: string;
    salary: string;
    startDate: string;
  }): void {
    const row = document.createElement("tr");
    const initials = this.getInitials(employee.name);
    const startDate = employee.startDate
      ? new Date(`${employee.startDate}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Today";

    row.innerHTML = `
      <td><div class="employee"><span class="mini-avatar" style="background:#2563eb">${initials}</span><div><strong>${this.escapeHtml(employee.name)}</strong><span>${this.escapeHtml(employee.email)}</span></div></div></td>
      <td>${this.escapeHtml(employee.department)}</td>
      <td>${this.escapeHtml(employee.position)}</td>
      <td>${startDate}</td>
      <td>${this.escapeHtml(employee.salary)}</td>
      <td><span class="status">Active</span></td>
      <td><div class="row-actions"><button class="small-btn" type="button">Edit</button><button class="small-btn danger-btn" type="button">Deactivate</button></div></td>
    `;
    this.tableBody.prepend(row);
  }

  private filterEmployees(): void {
    const term = this.searchInput.value.trim().toLowerCase();
    Array.from(this.tableBody.querySelectorAll("tr")).forEach((row) => {
      row.toggleAttribute("hidden", !row.textContent?.toLowerCase().includes(term));
    });
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

  private updateEmployeeCount(): void {
    this.employeeCount.textContent = String(this.tableBody.querySelectorAll("tr").length);
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
