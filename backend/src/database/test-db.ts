import mysql, { RowDataPacket } from "mysql2/promise";
import { envConfig } from "../config/env";

class DatabaseConnectionTester {
  public async run(): Promise<void> {
    console.log("Testing MySQL connection...");
    console.log(`  Host:     ${envConfig.db.host}`);
    console.log(`  User:     ${envConfig.db.user}`);
    console.log(`  Database: ${envConfig.db.database}`);
    console.log("");

    try {
      const conn = await mysql.createConnection(envConfig.db);

      console.log("Connected to MySQL successfully.");

      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id, name, email, role FROM users",
      );
      console.log(`Found ${rows.length} user(s) in the database:\n`);
      console.table(rows);

      await conn.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Connection failed:", message);
      console.log("\nCommon fixes:");
      console.log("  - Check DB_PASSWORD in .env");
      console.log("  - Make sure MySQL service is running");
      console.log("  - Run database.sql to create the database first");
      process.exitCode = 1;
    }
  }
}

void new DatabaseConnectionTester().run();
