import { Response } from "express";
import { HttpResponse } from "../utils/HttpResponse";

export abstract class BaseController {
  protected async handle(
    res: Response,
    label: string,
    action: () => Promise<void>,
  ): Promise<void> {
    try {
      await action();
    } catch (err) {
      console.error(`${label}:`, err);
      HttpResponse.error(res, 500, "Server error");
    }
  }

  protected sendError(res: Response, status: number, message: string): void {
    HttpResponse.error(res, status, message);
  }

  protected parsePositiveId(value: unknown): number | null {
    if (Array.isArray(value)) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
