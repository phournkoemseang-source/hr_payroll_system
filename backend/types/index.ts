export type UserRole = "admin" | "staff";

export interface IUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  created_at?: Date;
}

export interface IUserPublic {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface IJwtPayload {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ILoginResponse {
  token: string;
  user: IUserPublic;
}

export interface IErrorResponse {
  message: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}
