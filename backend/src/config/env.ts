import dotenv from "dotenv";

dotenv.config();

export class EnvConfig {
  public readonly port = Number(process.env.PORT || 3000);
  public readonly jwtSecret = process.env.JWT_SECRET || "";
  public readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN || "24h";
  public readonly db = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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
  }
}

export const envConfig = new EnvConfig();
