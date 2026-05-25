import { RequestHandler, Router } from "express";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";
import { UserRole } from "../models/User";

export abstract class BaseRoutes {
  public readonly router = Router();

  protected authenticated(): RequestHandler[] {
    return [AuthMiddleware.verifyToken];
  }

  protected allowRoles(...roles: UserRole[]): RequestHandler[] {
    return [AuthMiddleware.verifyToken, AuthMiddleware.requireRole(...roles)];
  }

  protected adminOnly(): RequestHandler[] {
    return this.allowRoles("admin");
  }

  protected staffOnly(): RequestHandler[] {
    return this.allowRoles("staff");
  }

  protected abstract initializeRoutes(): void;
}
