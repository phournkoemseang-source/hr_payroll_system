import { AuthController } from "../controllers/AuthController";
import { BaseRoutes } from "./BaseRoutes";

export class AuthRoutes extends BaseRoutes {
  private readonly authController = new AuthController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.post("/login", this.authController.login.bind(this.authController));
    this.router.get(
      "/me",
      ...this.authenticated(),
      this.authController.getMe.bind(this.authController),
    );
    this.router.post(
      "/users",
      ...this.adminOnly(),
      this.authController.createUser.bind(this.authController),
    );
  }
}
