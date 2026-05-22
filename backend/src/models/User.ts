export type UserRole = "admin" | "staff";

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  created_at?: Date;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export class User {
  constructor(private readonly record: UserRecord) {}

  public toPublicUser(): PublicUser {
    return {
      id: this.record.id,
      name: this.record.name,
      email: this.record.email,
      role: this.record.role,
    };
  }
}
