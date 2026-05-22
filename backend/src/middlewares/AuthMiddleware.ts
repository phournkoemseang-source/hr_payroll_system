import { Request, Response, NextFunction } from "express";
import { JwtUtil } from "../utils/JwtUtil";
import { HttpResponse } from "../utils/HttpResponse";
import { UserRole } from "../models/User";

export class AuthMiddleware {
  private static readonly jwtUtil = new JwtUtil();

  public static verifyToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      HttpResponse.error(res, 401, "No token provided");
      return;
    }

    try {
      req.user = AuthMiddleware.jwtUtil.verify(authHeader.split(" ")[1]);
      next();
    } catch {
      HttpResponse.error(res, 401, "Invalid or expired token");
    }
  }

  public static requireRole(
    ...allowedRoles: UserRole[]
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        HttpResponse.error(res, 401, "Authentication required");
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        HttpResponse.error(res, 403, "Insufficient permissions");
        return;
      }

      next();
    };
  }
}
