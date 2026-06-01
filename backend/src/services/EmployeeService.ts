import bcrypt from "bcryptjs";
import {
  CreateEmployeeRequest,
  Employee,
  UpdateEmployeeRequest,
} from "../models/Employee";
import { EmployeeRepository } from "../repositories/EmployeeRepository";

export class EmployeeService {
  constructor(private readonly employeeRepository = new EmployeeRepository()) {}

  public async listEmployees(): Promise<Employee[]> {
    return this.employeeRepository.findAll();
  }

  public async createEmployee(data: CreateEmployeeRequest): Promise<Employee | "email_exists"> {
    const email = data.email.trim().toLowerCase();
    if (await this.employeeRepository.findByEmail(email)) {
      return "email_exists";
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.employeeRepository.create(
      {
        ...data,
        name: data.name.trim(),
        email,
        department: data.department.trim(),
        position: data.position.trim(),
        status: data.status || "active",
      },
      hashedPassword,
    );
  }

  public async updateEmployee(
    id: number,
    data: UpdateEmployeeRequest,
  ): Promise<Employee | "not_found" | "email_exists"> {
    const email = data.email.trim().toLowerCase();
    if (await this.employeeRepository.emailBelongsToAnotherStaff(email, id)) {
      return "email_exists";
    }

    const password = data.password?.trim();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const employee = await this.employeeRepository.update(
      id,
      {
        ...data,
        name: data.name.trim(),
        email,
        department: data.department.trim(),
        position: data.position.trim(),
      },
      hashedPassword,
      password,
    );

    return employee || "not_found";
  }

  public async deleteEmployee(id: number): Promise<boolean> {
    return this.employeeRepository.delete(id);
  }

  public async updateOwnProfile(
    userId: number,
    data: { phoneNumber?: string | null; address?: string | null; dateOfBirth?: string | null },
  ): Promise<boolean> {
    return this.employeeRepository.updateOwnProfile(userId, data);
  }
}
