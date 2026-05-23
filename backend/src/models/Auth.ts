import { PublicUser, UserRole } from "./User";

export interface JwtPayload {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  position?: string;
  salary?: string | number;
  startDate?: string;
}

export interface ErrorResponse {
  message: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
