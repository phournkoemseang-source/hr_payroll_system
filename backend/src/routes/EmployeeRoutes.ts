import { Router } from "express";
import { EmployeeController } from "../controllers/EmployeeController";
import { AuthMiddleware } from "../middlewares/AuthMiddleware";

export class EmployeeRoutes {
  public readonly router = Router();
  private readonly employeeController = new EmployeeController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(AuthMiddleware.verifyToken, AuthMiddleware.requireRole("admin"));
    this.router.get("/", this.employeeController.list.bind(this.employeeController));
    this.router.post("/", this.employeeController.create.bind(this.employeeController));
    this.router.put("/:id", this.employeeController.update.bind(this.employeeController));
    this.router.delete("/:id", this.employeeController.delete.bind(this.employeeController));
  }
}
