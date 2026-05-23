import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { CreateUserRequest, LoginRequest } from "../models/Auth";
import { AuthValidation } from "../validations/AuthValidation";
import { BaseController } from "./BaseController";

export class AuthController extends BaseController {
  constructor(private readonly authService = new AuthService()) {
    super();
  }

  public async login(req: Request, res: Response): Promise<void> {
    const error = AuthValidation.validateLogin(req.body as Partial<LoginRequest>);
    if (error) {
      this.sendError(res, 400, error);
      return;
    }

    await this.handle(res, "Login error", async () => {
      const result = await this.authService.login(req.body as LoginRequest);
      if (!result) {
        this.sendError(res, 401, "Invalid email or password");
        return;
      }

      res.json(result);
    });
  }

  public getMe(req: Request, res: Response): void {
    res.json({ user: req.user });
  }

  public async createUser(req: Request, res: Response): Promise<void> {
    const error = AuthValidation.validateCreateUser(
      req.body as Partial<CreateUserRequest>,
    );
    if (error) {
      this.sendError(res, 400, error);
      return;
    }

    const data = req.body as CreateUserRequest;

    await this.handle(res, "Create user error", async () => {
      const emailExists = await this.authService.emailExists(data.email);
      if (emailExists) {
        this.sendError(res, 409, "A user with this email already exists");
        return;
      }

      const user = await this.authService.createUser(data);
      res.status(201).json({ user });
    });
  }
}
