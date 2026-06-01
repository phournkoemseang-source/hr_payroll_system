import { EmployeeController } from "../controllers/EmployeeController";
import { BaseRoutes } from "./BaseRoutes";

export class EmployeeRoutes extends BaseRoutes {
  private readonly employeeController = new EmployeeController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.patch(
      "/profile",
      ...this.authenticated(),
      this.employeeController.updateOwnProfile.bind(this.employeeController),
    );
    this.router.use(...this.adminOnly());
    this.router.get("/", this.employeeController.list.bind(this.employeeController));
    this.router.post("/", this.employeeController.create.bind(this.employeeController));
    this.router.put("/:id", this.employeeController.update.bind(this.employeeController));
    this.router.delete("/:id", this.employeeController.delete.bind(this.employeeController));
  }
}
