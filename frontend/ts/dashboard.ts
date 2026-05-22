type DashboardRole = "admin" | "staff";

interface DashboardUser {
  name: string;
  role: DashboardRole;
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

  private logout(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login.html";
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
