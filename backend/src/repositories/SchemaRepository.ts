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
    await this.ensureAttendanceSchema();

    await this.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        status ENUM('present','absent','late','on_leave') NOT NULL DEFAULT 'present',
        note VARCHAR(255) NULL,
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

    await this.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        leave_type ENUM('annual','sick','personal','unpaid','maternity','paternity') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INT NOT NULL DEFAULT 1,
        reason VARCHAR(500) NOT NULL DEFAULT '',
        status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
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

    await this.ensureLeaveRequestColumns();

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

  protected async ensureAttendanceSchema(): Promise<void> {
    await this.ensureEmployeeProfileSchema();

    await this.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        status ENUM('present','absent','late','on_leave') NOT NULL DEFAULT 'present',
        note VARCHAR(255) NULL,
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

    await this.ensureAttendanceColumn("note", "ALTER TABLE attendance_records ADD COLUMN note VARCHAR(255) NULL");
    await this.ensureAttendanceColumn("updated_by", "ALTER TABLE attendance_records ADD COLUMN updated_by INT NULL");
    await this.ensureAttendanceColumn(
      "updated_at",
      "ALTER TABLE attendance_records ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );
    await this.execute("ALTER TABLE attendance_records MODIFY status ENUM('present','absent','late','on_leave') NOT NULL DEFAULT 'present'");
  }

  protected async ensureLeaveRequestSchema(): Promise<void> {
    await this.ensureHrSchema();
    await this.ensureLeaveRequestColumns();
  }

  private async ensureLeaveRequestColumns(): Promise<void> {
    await this.ensureLeaveRequestColumn(
      "total_days",
      "ALTER TABLE leave_requests ADD COLUMN total_days INT NOT NULL DEFAULT 1 AFTER end_date",
    );
    await this.ensureLeaveRequestColumn(
      "reason",
      "ALTER TABLE leave_requests ADD COLUMN reason VARCHAR(500) NOT NULL DEFAULT '' AFTER total_days",
    );
    await this.ensureLeaveRequestColumn(
      "reviewer_id",
      "ALTER TABLE leave_requests ADD COLUMN reviewer_id INT NULL AFTER status",
    );
    await this.ensureLeaveRequestColumn(
      "reviewer_note",
      "ALTER TABLE leave_requests ADD COLUMN reviewer_note VARCHAR(500) NULL AFTER reviewer_id",
    );
    await this.ensureLeaveRequestColumn(
      "updated_at",
      "ALTER TABLE leave_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    );
    await this.execute(`
      UPDATE leave_requests
      SET leave_type = CASE
        WHEN LOWER(leave_type) LIKE '%annual%' THEN 'annual'
        WHEN LOWER(leave_type) LIKE '%sick%' THEN 'sick'
        WHEN LOWER(leave_type) LIKE '%unpaid%' THEN 'unpaid'
        WHEN LOWER(leave_type) LIKE '%maternity%' THEN 'maternity'
        WHEN LOWER(leave_type) LIKE '%paternity%' THEN 'paternity'
        WHEN LOWER(leave_type) IN ('annual','sick','personal','unpaid','maternity','paternity') THEN LOWER(leave_type)
        ELSE 'personal'
      END
    `);
    await this.execute(
      "ALTER TABLE leave_requests MODIFY status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending'",
    );
    await this.execute(
      "ALTER TABLE leave_requests MODIFY leave_type ENUM('annual','sick','personal','unpaid','maternity','paternity') NOT NULL",
    );
    await this.execute(`
      UPDATE leave_requests
      SET total_days = GREATEST(DATEDIFF(end_date, start_date) + 1, 1)
      WHERE total_days IS NULL OR total_days < 1
    `);
  }

  private async ensureLeaveRequestColumn(column: string, sql: string): Promise<void> {
    const rows = await this.query<RowDataPacket[]>("SHOW COLUMNS FROM leave_requests LIKE ?", [column]);

    if (rows.length === 0) {
      await this.execute(sql);
    }
  }

  private async ensureAttendanceColumn(column: string, sql: string): Promise<void> {
    const rows = await this.query<RowDataPacket[]>("SHOW COLUMNS FROM attendance_records LIKE ?", [column]);

    if (rows.length === 0) {
      await this.execute(sql);
    }
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
