type LoginRole = "admin" | "staff";

interface LoginUser {
  id: number;
  name: string;
  email: string;
  role: LoginRole;
}

interface LoginResponse {
  token: string;
  user: LoginUser;
  message?: string;
}

class LoginPage {
  private readonly api = "/api/auth/login";
  private readonly html = document.documentElement;
  private readonly themeToggle = this.getElement<HTMLButtonElement>("themeToggle");
  private readonly sunIcon = this.getElement<SVGElement>("sunIcon");
  private readonly moonIcon = this.getElement<SVGElement>("moonIcon");
  private readonly passwordInput = this.getElement<HTMLInputElement>("password");
  private readonly togglePassword = this.getElement<HTMLButtonElement>("togglePassword");
  private readonly eyeShow = this.getElement<SVGElement>("eyeShow");
  private readonly eyeHide = this.getElement<SVGElement>("eyeHide");
  private readonly emailInput = this.getElement<HTMLInputElement>("email");
  private readonly rememberMe = this.getElement<HTMLInputElement>("rememberMe");
  private readonly loginForm = this.getElement<HTMLFormElement>("loginForm");
  private readonly loginBtn = this.getElement<HTMLButtonElement>("loginBtn");
  private readonly btnText = this.getElement<HTMLElement>("btnText");
  private readonly btnLoader = this.getElement<HTMLElement>("btnLoader");
  private readonly errorAlert = this.getElement<HTMLElement>("errorAlert");
  private readonly errorText = this.getElement<HTMLElement>("errorText");

  public init(): void {
    this.redirectAuthenticatedUser();
    this.applyTheme(localStorage.getItem("theme") || "light");
    this.restoreRememberedEmail();
    this.bindEvents();
  }

  private bindEvents(): void {
    this.themeToggle.addEventListener("click", () => this.toggleTheme());
    this.togglePassword.addEventListener("click", () => this.togglePasswordVisibility());
    this.loginForm.addEventListener("submit", (event) => void this.handleSubmit(event));
  }

  private redirectAuthenticatedUser(): void {
    const user = this.getStoredUser();
    if (!user) {
      return;
    }

    window.location.href =
      user.role === "admin" ? "/admin/dashboard.html" : "/staff/dashboard.html";
  }

  private getStoredUser(): LoginUser | null {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const userJson = localStorage.getItem("user") || sessionStorage.getItem("user");

    if (!token || !userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson) as LoginUser;
    } catch {
      return null;
    }
  }

  private toggleTheme(): void {
    const nextTheme = this.html.dataset.theme === "dark" ? "light" : "dark";
    this.applyTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  }

  private applyTheme(theme: string): void {
    this.html.dataset.theme = theme;
    this.sunIcon.style.display = theme === "dark" ? "block" : "none";
    this.moonIcon.style.display = theme === "dark" ? "none" : "block";
  }

  private togglePasswordVisibility(): void {
    const shouldShow = this.passwordInput.type === "password";
    this.passwordInput.type = shouldShow ? "text" : "password";
    this.eyeShow.style.display = shouldShow ? "none" : "block";
    this.eyeHide.style.display = shouldShow ? "block" : "none";
  }

  private restoreRememberedEmail(): void {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      this.emailInput.value = savedEmail;
      this.rememberMe.checked = true;
    }
  }

  private async handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.hideError();

    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      this.showError("Please enter your email and password.");
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch(this.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as LoginResponse;

      if (!response.ok) {
        this.showError(data.message || "Invalid email or password.");
        return;
      }

      this.persistSession(data, email);
      window.location.href =
        data.user.role === "admin" ? "/admin/dashboard.html" : "/staff/dashboard.html";
    } catch {
      this.showError("Unable to connect to server. Please try again.");
    } finally {
      this.setLoading(false);
    }
  }

  private persistSession(data: LoginResponse, email: string): void {
    const storage = this.rememberMe.checked ? localStorage : sessionStorage;
    storage.setItem("token", data.token);
    storage.setItem("user", JSON.stringify(data.user));

    if (this.rememberMe.checked) {
      localStorage.setItem("rememberedEmail", email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }
  }

  private setLoading(state: boolean): void {
    this.loginBtn.disabled = state;
    this.btnText.style.display = state ? "none" : "flex";
    this.btnLoader.style.display = state ? "flex" : "none";
  }

  private showError(message: string): void {
    this.errorText.textContent = message;
    this.errorAlert.style.display = "flex";
    this.errorAlert.style.animation = "none";
    requestAnimationFrame(() => {
      this.errorAlert.style.animation = "";
    });
  }

  private hideError(): void {
    this.errorAlert.style.display = "none";
  }

  private getElement<T extends HTMLElement | SVGElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required element: ${id}`);
    }
    return element as T;
  }
}

new LoginPage().init();
