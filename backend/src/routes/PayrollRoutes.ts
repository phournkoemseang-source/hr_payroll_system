import { PayrollController } from "../controllers/PayrollController";
import { BaseRoutes } from "./BaseRoutes";

export class PayrollRoutes extends BaseRoutes {
  private readonly payrollController = new PayrollController();

  constructor() {
    super();
    this.initializeRoutes();
  }

  protected initializeRoutes(): void {
    this.router.use(...this.adminOnly());
    this.router.get("/settings/:userId", this.payrollController.getSettings.bind(this.payrollController));
    this.router.put("/settings/:userId", this.payrollController.saveSettings.bind(this.payrollController));
    this.router.post("/calculate", this.payrollController.calculate.bind(this.payrollController));
    this.router.post("/calculate/save", this.payrollController.saveCalculatedPayroll.bind(this.payrollController));
    this.router.get("/period", this.payrollController.getPeriodPayroll.bind(this.payrollController));
    this.router.delete("/period", this.payrollController.deletePeriodPayroll.bind(this.payrollController));
  }
}
