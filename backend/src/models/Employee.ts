export type EmployeeStatus = "active" | "inactive";

export interface Employee {
  id: number;
  name: string;
  email: string;
  loginPassword: string | null;
  department: string;
  position: string;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: string | null;
  profilePhoto: string | null;
  startDate: string | null;
  salary: number;
  status: EmployeeStatus;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  department: string;
  position: string;
  startDate?: string;
  salary: string | number;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeRequest {
  name: string;
  email: string;
  password?: string;
  department: string;
  position: string;
  startDate?: string | null;
  salary: string | number;
  status: EmployeeStatus;
}

export interface UpdateOwnProfileRequest {
  name?: string;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  profilePhoto?: string | null;
}
