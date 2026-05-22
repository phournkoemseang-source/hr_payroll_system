import dotenv from "dotenv";
import express, { Application as ExpressApplication } from "express";
import cors from "cors";
import path from "path";
import { AuthRoutes } from "./routes/AuthRoutes";

dotenv.config();

class Application {
  private readonly app: ExpressApplication;
  private readonly port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;

    this.configureMiddleware();
    this.configureRoutes();
    this.configureFrontendFallback();
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server running on http://localhost:${this.port}`);
    });
  }

  private configureMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../frontend")));
  }

  private configureRoutes(): void {
    const authRoutes = new AuthRoutes();
    this.app.use("/api/auth", authRoutes.router);
  }

  private configureFrontendFallback(): void {
    this.app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "../frontend/login.html"));
    });
  }
}

new Application().start();
