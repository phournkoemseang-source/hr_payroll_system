import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { envConfig } from "../config/env";

class DatabaseSetup {
  public async run(): Promise<void> {
    console.log("Setting up HR Payroll database...");
    console.log(`  Host:     ${envConfig.db.host}`);
    console.log(`  User:     ${envConfig.db.user}`);
    console.log(`  Database: ${envConfig.db.database}`);
    console.log("");

    try {
      // Create database if not exists
      const connection = await mysql.createConnection({
        host: envConfig.db.host,
        user: envConfig.db.user,
        password: envConfig.db.password,
      });

      await connection.query(
        `CREATE DATABASE IF NOT EXISTS ${envConfig.db.database}`,
      );
      console.log("✓ Database created/verified");

      await connection.end();

      // Connect to the database
      const db = await mysql.createConnection(envConfig.db);

      // Create tables
      await this.createTables(db);
      console.log("✓ Tables created");

      // Seed data
      await this.seedData(db);
      console.log("✓ Sample data seeded");

      await db.end();
      console.log("\nDatabase setup complete!");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Setup failed:", message);
      process.exitCode = 1;
    }
  }

  private async createTables(db: mysql.Connection): Promise<void> {
    // Drop existing tables to ensure clean schema
    await db.query("DROP TABLE IF EXISTS payroll_records");
    await db.query("DROP TABLE IF EXISTS leave_requests");
    await db.query("DROP TABLE IF EXISTS attendance_records");
    await db.query("DROP TABLE IF EXISTS employee_profiles");
    await db.query("DROP TABLE IF EXISTS users");

    // Users table
    await db.query(`
      CREATE TABLE users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100)        NOT NULL,
        email      VARCHAR(150) UNIQUE NOT NULL,
        password   VARCHAR(255)        NOT NULL,
        login_password VARCHAR(255)    NULL,
        role       ENUM('admin','staff') NOT NULL DEFAULT 'staff',
        created_at TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee profiles table
    await db.query(`
      CREATE TABLE employee_profiles (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL UNIQUE,
        department  VARCHAR(100) NOT NULL DEFAULT 'Operations',
        position    VARCHAR(100) NOT NULL DEFAULT 'Staff',
        start_date  DATE NULL,
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_employee_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Attendance records table
    await db.query(`
      CREATE TABLE attendance_records (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        work_date  DATE NOT NULL,
        status     ENUM('present','absent','late') NOT NULL DEFAULT 'present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_attendance_user_date (user_id, work_date),
        CONSTRAINT fk_attendance_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Leave requests table
    await db.query(`
      CREATE TABLE leave_requests (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        leave_type VARCHAR(60) NOT NULL,
        start_date DATE NOT NULL,
        end_date   DATE NOT NULL,
        status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_leave_requests_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Payroll records table
    await db.query(`
      CREATE TABLE payroll_records (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        pay_period DATE NOT NULL,
        gross_pay  DECIMAL(12,2) NOT NULL DEFAULT 0,
        status     ENUM('draft','paid') NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_payroll_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);
  }

  private async seedData(db: mysql.Connection): Promise<void> {
    // Hash passwords
    const adminPassword = await bcrypt.hash("Admin@123", 10);
    const staffPassword = await bcrypt.hash("Staff@123", 10);

    // Insert admin user
    await db.query(
      `INSERT IGNORE INTO users (id, name, email, password, login_password, role) VALUES
        (1, 'Admin User', 'admin@hrpayroll.com', ?, NULL, 'admin')`,
      [adminPassword],
    );

    // Insert staff user
    await db.query(
      `INSERT IGNORE INTO users (id, name, email, password, login_password, role) VALUES
        (2, 'Staff User', 'staff@hrpayroll.com', ?, 'Staff@123', 'staff')`,
      [staffPassword],
    );

    // Insert employee profiles
    await db.query(
      `INSERT IGNORE INTO employee_profiles (user_id, department, position, start_date, base_salary, status) VALUES
        (1, 'HR', 'Administrator', CURDATE(), 0, 'active'),
        (2, 'Operations', 'Staff', CURDATE(), 500, 'active')`,
    );

    // Insert sample attendance records for the current week
    const today = new Date();
    const day = today.getDay();
    const distanceFromMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceFromMonday);

    for (let i = 0; i < 5; i++) {
      const workDate = new Date(monday);
      workDate.setDate(monday.getDate() + i);
      const dateStr = workDate.toISOString().slice(0, 10);

      // Admin attendance
      await db.query(
        `INSERT IGNORE INTO attendance_records (user_id, work_date, status) VALUES (1, ?, 'present')`,
        [dateStr],
      );

      // Staff attendance
      await db.query(
        `INSERT IGNORE INTO attendance_records (user_id, work_date, status) VALUES (2, ?, 'present')`,
        [dateStr],
      );
    }

    // Insert sample leave requests
    await db.query(
      `INSERT IGNORE INTO leave_requests (user_id, leave_type, start_date, end_date, status) VALUES
        (2, 'Annual', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'pending')`,
    );

    // Insert sample payroll records
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    await db.query(
      `INSERT IGNORE INTO payroll_records (user_id, pay_period, gross_pay, status) VALUES
        (1, ?, 0, 'paid'),
        (2, ?, 500, 'paid')`,
      [
        firstOfMonth.toISOString().slice(0, 10),
        firstOfMonth.toISOString().slice(0, 10),
      ],
    );
  }
}

void new DatabaseSetup().run();
