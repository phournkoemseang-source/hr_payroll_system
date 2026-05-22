import { Router, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { UserModel } from "../models/User";
import { AuthMiddleware } from "../middleware/AuthMiddleware";
import { ILoginRequest, ILoginResponse, IErrorResponse } from "../types";

export class AuthRoutes {
  public readonly router: Router;
  private readonly userModel: UserModel;

  constructor() {
    this.router = Router();
    this.userModel = new UserModel();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/login", this.login.bind(this));
    this.router.get("/me", AuthMiddleware.verifyToken, this.getMe.bind(this));
  }

  private async login(req: Request, res: Response): Promise<void> {
    const { email, password }: ILoginRequest = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({
          message: "Email and password are required",
        } satisfies IErrorResponse);
      return;
    }

    try {
      const user = await this.userModel.findByEmail(email);

      if (!user) {
        res
          .status(401)
          .json({
            message: "Invalid email or password",
          } satisfies IErrorResponse);
        return;
      }

      const isMatch = await this.userModel.verifyPassword(
        password,
        user.password,
      );

      if (!isMatch) {
        res
          .status(401)
          .json({
            message: "Invalid email or password",
          } satisfies IErrorResponse);
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res
          .status(500)
          .json({
            message: "Server configuration error",
          } satisfies IErrorResponse);
        return;
      }

      const expiresIn: SignOptions["expiresIn"] =
        (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "24h";

      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        secret,
        { expiresIn },
      );

      const response: ILoginResponse = {
        token,
        user: this.userModel.toPublicUser(user),
      };

      res.json(response);
    } catch (err) {
      console.error("Login error:", err);
      res
        .status(500)
        .json({ message: "Server error" } satisfies IErrorResponse);
    }
  }

  private getMe(req: Request, res: Response): void {
    res.json({ user: req.user });
  }
}
