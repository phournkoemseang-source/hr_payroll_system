import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { CreateUserRequest, LoginRequest } from "../models/Auth";
import { AuthValidation } from "../validations/AuthValidation";
import { HttpResponse } from "../utils/HttpResponse";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  public async login(req: Request, res: Response): Promise<void> {
    const error = AuthValidation.validateLogin(req.body as Partial<LoginRequest>);
    if (error) {
      HttpResponse.error(res, 400, error);
      return;
    }

    try {
      const result = await this.authService.login(req.body as LoginRequest);
      if (!result) {
        HttpResponse.error(res, 401, "Invalid email or password");
        return;
      }

      res.json(result);
    } catch (err) {
      console.error("Login error:", err);
      HttpResponse.error(res, 500, "Server error");
    }
  }

  public getMe(req: Request, res: Response): void {
    res.json({ user: req.user });
  }

  public async createUser(req: Request, res: Response): Promise<void> {
    const error = AuthValidation.validateCreateUser(
      req.body as Partial<CreateUserRequest>,
    );
    if (error) {
      HttpResponse.error(res, 400, error);
      return;
    }

    const data = req.body as CreateUserRequest;

    try {
      const emailExists = await this.authService.emailExists(data.email);
      if (emailExists) {
        HttpResponse.error(res, 409, "A user with this email already exists");
        return;
      }

      const user = await this.authService.createUser(data);
      res.status(201).json({ user });
    } catch (err) {
      console.error("Create user error:", err);
      HttpResponse.error(res, 500, "Server error");
    }
  }
}
