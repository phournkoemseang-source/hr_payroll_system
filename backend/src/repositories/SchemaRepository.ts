import { RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";

export abstract class SchemaRepository extends BaseRepository {
  protected async ensureEmployeeProfileSchema(): Promise<void> {
    await this.ensureUserLoginPasswordColumn();

    await this.execute(`
      CREATE TABLE IF NOT EXISTS employee_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        department VARCHAR(100) NOT NULL DEFAULT 'Operations',
        position VARCHAR(100) NOT NULL DEFAULT 'Staff',
        start_date DATE NULL,
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_employee_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await this.seedMissingEmployeeProfiles();
  }

  private async ensureUserLoginPasswordColumn(): Promise<void> {
    const rows = await this.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'login_password'",
    );

    if (rows.length > 0) {
      return;
    }

    await this.execute("ALTER TABLE users ADD COLUMN login_password VARCHAR(255) NULL");
    await this.execute(`
      UPDATE users
      SET login_password = CASE
        WHEN email = 'staff@hrpayroll.com' THEN 'Staff@123'
        ELSE login_password
      END
      WHERE role = 'staff' AND login_password IS NULL
    `);
  }

  protected async ensureHrSchema(): Promise<void> {
    await this.ensureEmployeeProfileSchema();

    await this.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        status ENUM('present','absent','late') NOT NULL DEFAULT 'present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_attendance_user_date (user_id, work_date),
        CONSTRAINT fk_attendance_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        leave_type VARCHAR(60) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_leave_requests_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await this.execute(`
      CREATE TABLE IF NOT EXISTS payroll_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        pay_period DATE NOT NULL,
        gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
        status ENUM('draft','paid') NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_payroll_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);
  }

  private async seedMissingEmployeeProfiles(): Promise<void> {
    await this.execute(`
      INSERT IGNORE INTO employee_profiles (user_id, department, position, start_date, base_salary)
      SELECT id,
        CASE WHEN role = 'admin' THEN 'HR' ELSE 'Operations' END,
        CASE WHEN role = 'admin' THEN 'Administrator' ELSE 'Staff' END,
        DATE(created_at),
        0
      FROM users
    `);
  }
}
