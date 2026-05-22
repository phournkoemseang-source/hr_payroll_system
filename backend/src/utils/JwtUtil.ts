import jwt, { SignOptions } from "jsonwebtoken";
import { envConfig } from "../config/env";
import { JwtPayload } from "../models/Auth";
import { PublicUser } from "../models/User";

export class JwtUtil {
  public sign(user: PublicUser): string {
    const expiresIn = envConfig.jwtExpiresIn as SignOptions["expiresIn"];
    return jwt.sign(user, envConfig.jwtSecret, { expiresIn });
  }

  public verify(token: string): JwtPayload {
    return jwt.verify(token, envConfig.jwtSecret) as JwtPayload;
  }
}
