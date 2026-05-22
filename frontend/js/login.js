"use strict";
class LoginPage {
    constructor() {
        this.api = "/api/auth/login";
        this.html = document.documentElement;
        this.themeToggle = this.getElement("themeToggle");
        this.sunIcon = this.getElement("sunIcon");
        this.moonIcon = this.getElement("moonIcon");
        this.passwordInput = this.getElement("password");
        this.togglePassword = this.getElement("togglePassword");
        this.eyeShow = this.getElement("eyeShow");
        this.eyeHide = this.getElement("eyeHide");
        this.emailInput = this.getElement("email");
        this.rememberMe = this.getElement("rememberMe");
        this.loginForm = this.getElement("loginForm");
        this.loginBtn = this.getElement("loginBtn");
        this.btnText = this.getElement("btnText");
        this.btnLoader = this.getElement("btnLoader");
        this.errorAlert = this.getElement("errorAlert");
        this.errorText = this.getElement("errorText");
    }
    init() {
        this.redirectAuthenticatedUser();
        this.applyTheme(localStorage.getItem("theme") || "light");
        this.restoreRememberedEmail();
        this.bindEvents();
    }
    bindEvents() {
        this.themeToggle.addEventListener("click", () => this.toggleTheme());
        this.togglePassword.addEventListener("click", () => this.togglePasswordVisibility());
        this.loginForm.addEventListener("submit", (event) => void this.handleSubmit(event));
    }
    redirectAuthenticatedUser() {
        const user = this.getStoredUser();
        if (!user) {
            return;
        }
        window.location.href =
            user.role === "admin" ? "/admin/dashboard.html" : "/staff/dashboard.html";
    }
    getStoredUser() {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const userJson = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (!token || !userJson) {
            return null;
        }
        try {
            return JSON.parse(userJson);
        }
        catch {
            return null;
        }
    }
    toggleTheme() {
        const nextTheme = this.html.dataset.theme === "dark" ? "light" : "dark";
        this.applyTheme(nextTheme);
        localStorage.setItem("theme", nextTheme);
    }
    applyTheme(theme) {
        this.html.dataset.theme = theme;
        this.sunIcon.style.display = theme === "dark" ? "block" : "none";
        this.moonIcon.style.display = theme === "dark" ? "none" : "block";
    }
    togglePasswordVisibility() {
        const shouldShow = this.passwordInput.type === "password";
        this.passwordInput.type = shouldShow ? "text" : "password";
        this.eyeShow.style.display = shouldShow ? "none" : "block";
        this.eyeHide.style.display = shouldShow ? "block" : "none";
    }
    restoreRememberedEmail() {
        const savedEmail = localStorage.getItem("rememberedEmail");
        if (savedEmail) {
            this.emailInput.value = savedEmail;
            this.rememberMe.checked = true;
        }
    }
    async handleSubmit(event) {
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
            const data = (await response.json());
            if (!response.ok) {
                this.showError(data.message || "Invalid email or password.");
                return;
            }
            this.persistSession(data, email);
            window.location.href =
                data.user.role === "admin" ? "/admin/dashboard.html" : "/staff/dashboard.html";
        }
        catch {
            this.showError("Unable to connect to server. Please try again.");
        }
        finally {
            this.setLoading(false);
        }
    }
    persistSession(data, email) {
        const storage = this.rememberMe.checked ? localStorage : sessionStorage;
        storage.setItem("token", data.token);
        storage.setItem("user", JSON.stringify(data.user));
        if (this.rememberMe.checked) {
            localStorage.setItem("rememberedEmail", email);
        }
        else {
            localStorage.removeItem("rememberedEmail");
        }
    }
    setLoading(state) {
        this.loginBtn.disabled = state;
        this.btnText.style.display = state ? "none" : "flex";
        this.btnLoader.style.display = state ? "flex" : "none";
    }
    showError(message) {
        this.errorText.textContent = message;
        this.errorAlert.style.display = "flex";
        this.errorAlert.style.animation = "none";
        requestAnimationFrame(() => {
            this.errorAlert.style.animation = "";
        });
    }
    hideError() {
        this.errorAlert.style.display = "none";
    }
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Missing required element: ${id}`);
        }
        return element;
    }
}
new LoginPage().init();
