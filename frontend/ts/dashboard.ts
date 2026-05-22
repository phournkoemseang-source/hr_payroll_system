type DashboardRole = "admin" | "staff";

interface DashboardUser {
  name: string;
  role: DashboardRole;
}

interface CreateUserResponse {
  message?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: DashboardRole;
  };
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
    this.userRole.textContent = user.role;
    this.logoutButton.addEventListener("click", () => this.logout());

    this.initializeCreateUserForm();
  }

  private initializeCreateUserForm(): void {
    const form = document.getElementById("createUserForm") as HTMLFormElement | null;
    const button = document.getElementById("createUserButton") as HTMLButtonElement | null;
    const alert = document.getElementById("createUserAlert") as HTMLElement | null;

    if (!form || !button || !alert) {
      return;
    }

    form.addEventListener("submit", (event) => {
      void this.handleCreateUser(event, form, button, alert);
    });
  }

  private async handleCreateUser(
    event: SubmitEvent,
    form: HTMLFormElement,
    button: HTMLButtonElement,
    alert: HTMLElement,
  ): Promise<void> {
    event.preventDefault();
    this.setAlert(alert, "", "");

    const token = this.getStoredToken();
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "staff") as DashboardRole;

    if (!name || !email || !password) {
      this.setAlert(alert, "Please complete all fields.", "error");
      return;
    }

    if (password.length < 6) {
      this.setAlert(alert, "Password must be at least 6 characters.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Creating...";

    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = (await response.json()) as CreateUserResponse;

      if (!response.ok) {
        this.setAlert(alert, data.message || "Unable to create user.", "error");
        return;
      }

      form.reset();
      this.setAlert(
        alert,
        `${data.user?.name || "User"} was created as ${data.user?.role || role}.`,
        "success",
      );
    } catch {
      this.setAlert(alert, "Unable to connect to server.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Create User";
    }
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

  private setAlert(alert: HTMLElement, message: string, type: "" | "error" | "success"): void {
    alert.textContent = message;
    alert.className = type ? `alert ${type}` : "alert";
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
