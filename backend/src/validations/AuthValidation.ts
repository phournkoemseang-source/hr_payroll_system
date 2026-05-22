import { CreateUserRequest, LoginRequest } from "../models/Auth";
import { UserRole } from "../models/User";

export class AuthValidation {
  public static validateLogin(body: Partial<LoginRequest>): string | null {
    if (!body.email || !body.password) {
      return "Email and password are required";
    }
    return null;
  }

  public static validateCreateUser(body: Partial<CreateUserRequest>): string | null {
    if (!body.name || !body.email || !body.password || !body.role) {
      return "Name, email, password, and role are required";
    }

    if (!this.isValidRole(body.role)) {
      return "Role must be admin or staff";
    }

    if (body.password.length < 6) {
      return "Password must be at least 6 characters";
    }

    return null;
  }

  public static isValidRole(role: unknown): role is UserRole {
    return role === "admin" || role === "staff";
  }
}
