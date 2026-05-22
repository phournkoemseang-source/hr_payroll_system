import { Response } from "express";
import { ErrorResponse } from "../models/Auth";

export class HttpResponse {
  public static error(res: Response, status: number, message: string): void {
    res.status(status).json({ message } satisfies ErrorResponse);
  }
}
