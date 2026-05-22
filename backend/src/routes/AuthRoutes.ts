import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";

export class AuthRoutes {
  public readonly router = Router();
  private readonly authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/login", this.authController.login.bind(this.authController));
    this.router.get(
      "/me",
      AuthMiddleware.verifyToken,
      this.authController.getMe.bind(this.authController),
    );
    this.router.post(
      "/users",
      AuthMiddleware.verifyToken,
      AuthMiddleware.requireRole("admin"),
      this.authController.createUser.bind(this.authController),
    );
  }
}
