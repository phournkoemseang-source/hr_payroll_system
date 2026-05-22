import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IJwtPayload } from "../types";

export class AuthMiddleware {
  public static verifyToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET is not defined");
      }

      req.user = jwt.verify(token, secret) as IJwtPayload;
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  }

  public static requireRole(
    ...allowedRoles: string[]
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({ message: "Insufficient permissions" });
        return;
      }

      next();
    };
  }
}
