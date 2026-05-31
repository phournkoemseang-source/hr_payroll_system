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
    await db.query("DROP TABLE IF EXISTS payroll_settings");
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
        status     ENUM('present','absent','late','on_leave') NOT NULL DEFAULT 'present',
        note       VARCHAR(255) NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_attendance_user_date (user_id, work_date),
        CONSTRAINT fk_attendance_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_attendance_updated_by
          FOREIGN KEY (updated_by) REFERENCES users(id)
          ON DELETE SET NULL
      )
    `);

    // Leave requests table
    await db.query(`
      CREATE TABLE leave_requests (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        leave_type ENUM('annual','sick','personal','unpaid','maternity','paternity') NOT NULL,
        start_date DATE NOT NULL,
        end_date   DATE NOT NULL,
        total_days INT NOT NULL DEFAULT 1,
        reason     VARCHAR(500) NOT NULL DEFAULT '',
        status     ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
        reviewer_id INT NULL,
        reviewer_note VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_leave_user_created (user_id, created_at),
        INDEX idx_leave_status_created (status, created_at),
        CONSTRAINT fk_leave_requests_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_leave_requests_reviewer
          FOREIGN KEY (reviewer_id) REFERENCES users(id)
          ON DELETE SET NULL
      )
    `);

    // Payroll records table
    await db.query(`
      CREATE TABLE payroll_records (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        pay_period DATE NOT NULL,
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
        deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
        gross_pay  DECIMAL(12,2) NOT NULL DEFAULT 0,
        net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
        status     ENUM('draft','paid') NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_payroll_user_period (user_id, pay_period),
        CONSTRAINT fk_payroll_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Payroll settings table
    await db.query(`
      CREATE TABLE payroll_settings (
        id                       INT AUTO_INCREMENT PRIMARY KEY,
        user_id                  INT NOT NULL UNIQUE,
        base_salary              DECIMAL(12,2) NOT NULL DEFAULT 0,
        housing_allowance        DECIMAL(12,2) NOT NULL DEFAULT 0,
        transport_allowance      DECIMAL(12,2) NOT NULL DEFAULT 0,
        other_allowances         DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_absent_day DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_late_day   DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_half_day   DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_payroll_settings_user
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

    await db.query(
      `INSERT IGNORE INTO payroll_settings
        (user_id, base_salary, housing_allowance, transport_allowance, other_allowances,
         deduction_per_absent_day, deduction_per_late_day, deduction_per_half_day)
       VALUES
        (2, 500, 0, 0, 0, 0, 0, 0)`,
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
      `INSERT IGNORE INTO leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status) VALUES
        (2, 'annual', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 4, 'Family trip', 'pending')`,
    );

    // Insert sample payroll records
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    await db.query(
      `INSERT IGNORE INTO payroll_records
        (user_id, pay_period, base_salary, allowances, deductions, gross_pay, net_pay, status)
       VALUES
        (2, ?, 500, 0, 0, 500, 500, 'paid')`,
      [
        firstOfMonth.toISOString().slice(0, 10),
      ],
    );
  }
}

void new DatabaseSetup().run();
