import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});
dotenv.config({
  path: path.resolve(process.cwd(), "backend", ".env"),
});

export class EnvConfig {
  public readonly port = Number(process.env.PORT || 3000);
  public readonly jwtSecret = process.env.JWT_SECRET || "";
  public readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";
  public readonly db = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
    ...(process.env.DB_SOCKET_PATH ? { socketPath: process.env.DB_SOCKET_PATH } : {}),
  };

  public validate(): void {
    const required = {
      JWT_SECRET: this.jwtSecret,
      DB_HOST: this.db.host,
      DB_USER: this.db.user,
      DB_NAME: this.db.database,
    };

    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
    }

    const placeholderValues = Object.entries({
      JWT_SECRET: this.jwtSecret,
      DB_HOST: this.db.host,
      DB_USER: this.db.user,
      DB_PASSWORD: this.db.password,
      DB_NAME: this.db.database,
    })
      .filter(([, value]) => typeof value === "string" && value.startsWith("your_"))
      .map(([key]) => key);

    if (placeholderValues.length > 0) {
      throw new Error(
        `Replace placeholder environment variable(s): ${placeholderValues.join(", ")}`,
      );
    }
  }
}

export const envConfig = new EnvConfig();
