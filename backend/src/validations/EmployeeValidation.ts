import {
  CreateEmployeeRequest,
  EmployeeStatus,
  UpdateEmployeeRequest,
} from "../models/Employee";

export class EmployeeValidation {
  public static validateCreate(
    body: Partial<CreateEmployeeRequest>,
  ): string | null {
    const baseError = this.validateBase(body);
    if (baseError) {
      return baseError;
    }

    if (!body.password) {
      return "Password is required";
    }

    if (body.password.length < 6) {
      return "Password must be at least 6 characters";
    }

    return null;
  }

  public static validateUpdate(
    body: Partial<UpdateEmployeeRequest>,
  ): string | null {
    const baseError = this.validateBase(body);
    if (baseError) {
      return baseError;
    }

    if (!this.isValidStatus(body.status)) {
      return "Status must be active or inactive";
    }

    return null;
  }

  public static isValidStatus(status: unknown): status is EmployeeStatus {
    return status === "active" || status === "inactive";
  }

  private static validateBase(
    body: Partial<CreateEmployeeRequest | UpdateEmployeeRequest>,
  ): string | null {
    if (!body.name || !body.email || !body.department || !body.position) {
      return "Name, email, department, and position are required";
    }

    if (!String(body.email).includes("@")) {
      return "Email must be valid";
    }

    if (body.salary === undefined || body.salary === null || body.salary === "") {
      return "Base salary is required";
    }

    if (!Number.isFinite(this.parseSalary(body.salary))) {
      return "Base salary must be a number";
    }

    return null;
  }

  private static parseSalary(value: string | number): number {
    if (typeof value === "number") {
      return value;
    }
    return Number(value.replace(/[^0-9.-]/g, ""));
  }
}
