import { RowDataPacket } from "mysql2";
import { BaseRepository } from "./BaseRepository";

export abstract class SchemaRepository extends BaseRepository {
  private static schemaInitialized = false;

  public async initializeSchema(): Promise<void> {
    if (SchemaRepository.schemaInitialized) return;
    
    console.log("Initializing database schema...");
    await this.ensureEmployeesTable();
    await this.ensureEmployeeProfilesTable();
    await this.ensureHrSchema();
    await this.seedMissingEmployees();
    
    SchemaRepository.schemaInitialized = true;
    console.log("Database schema initialized.");
  }

  protected async ensureEmployeesTable(): Promise<void> {
    // 1. Check if an incompatible 'employees' table exists (e.g., legacy table from another system)
    const employeesColumns = await this.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM employees LIKE 'user_id'"
    ).catch(() => []);

    const employeesExists = await this.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'employees'"
    );

    if (employeesExists.length > 0 && employeesColumns.length === 0) {
      console.log("Incompatible 'employees' table found. Renaming to 'legacy_employees'...");
      await this.execute("RENAME TABLE employees TO legacy_employees");
    }

    // 2. Check if 'employee_profiles' exists and rename it to 'employees'
    const profilesExists = await this.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'employee_profiles'"
    );
    const employeesExistsNow = await this.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'employees'"
    );

    if (profilesExists.length > 0 && employeesExistsNow.length === 0) {
      console.log("Renaming 'employee_profiles' to 'employees'...");
      await this.execute("RENAME TABLE employee_profiles TO employees");
    }

    // 3. Create employees table if it still doesn't exist
    await this.execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        department VARCHAR(100) NOT NULL DEFAULT 'Management',
        position VARCHAR(100) NOT NULL DEFAULT 'Staff',
        start_date DATE NULL,
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        annual_leave_balance INT NOT NULL DEFAULT 18,
        sick_leave_balance INT NOT NULL DEFAULT 6,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_employees_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // 4. Ensure all required columns exist in employees (in case it existed with different structure)
    await this.ensureColumn("employees", "user_id", "ALTER TABLE employees ADD COLUMN user_id INT NOT NULL UNIQUE AFTER id");
    await this.ensureColumn("employees", "department", "ALTER TABLE employees ADD COLUMN department VARCHAR(100) NOT NULL DEFAULT 'Management' AFTER user_id");
    await this.ensureColumn("employees", "position", "ALTER TABLE employees ADD COLUMN position VARCHAR(100) NOT NULL DEFAULT 'Staff' AFTER department");
    await this.ensureColumn("employees", "status", "ALTER TABLE employees ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER base_salary");
    await this.ensureColumn("employees", "annual_leave_balance", "ALTER TABLE employees ADD COLUMN annual_leave_balance INT NOT NULL DEFAULT 18");
    await this.ensureColumn("employees", "sick_leave_balance", "ALTER TABLE employees ADD COLUMN sick_leave_balance INT NOT NULL DEFAULT 6");
    
    // Ensure users has login_password
    await this.ensureUserLoginPasswordColumn();
  }

  private async ensureColumn(table: string, column: string, sql: string): Promise<void> {
    const rows = await this.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM ${table} LIKE ?`,
      [column]
    );
    if (rows.length === 0) {
      await this.execute(sql);
    }
  }

  protected async ensureEmployeeProfilesTable(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS employee_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        phone_number VARCHAR(50) NULL,
        address VARCHAR(255) NULL,
        date_of_birth DATE NULL,
        profile_photo LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_profiles_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Migrate data from 'employees' to 'employee_profiles' if columns still exist in 'employees'
    const columns = await this.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM employees WHERE Field IN ('phone_number', 'address', 'date_of_birth', 'profile_photo')"
    );

    if (columns.length > 0) {
      console.log("Migrating profile data to employee_profiles table...");
      await this.execute(`
        INSERT IGNORE INTO employee_profiles (user_id, phone_number, address, date_of_birth, profile_photo)
        SELECT user_id, phone_number, address, date_of_birth, profile_photo FROM employees
      `);

      // Drop columns from employees
      for (const col of columns) {
        await this.execute(`ALTER TABLE employees DROP COLUMN ${col.Field}`);
      }
    }
  }

  private async ensureUserLoginPasswordColumn(): Promise<void> {
    const rows = await this.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM users LIKE 'login_password'",
    );

    if (rows.length === 0) {
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
  }

  protected async ensureHrSchema(): Promise<void> {
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
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
        deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
        gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
        net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
        status ENUM('draft','paid') NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_payroll_user_period (user_id, pay_period),
        CONSTRAINT fk_payroll_records_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await this.ensurePayrollSettingsSchema();
  }

  protected async ensurePayrollSettingsSchema(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS payroll_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        housing_allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
        transport_allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
        other_allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_absent_day DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_late_day DECIMAL(12,2) NOT NULL DEFAULT 0,
        deduction_per_half_day DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_payroll_settings_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);
  }

  private async ensureLeaveRequestColumns(): Promise<void> {
    // Basic migration and cleanup logic for leave_requests if needed
    await this.execute(`
      UPDATE leave_requests
      SET total_days = GREATEST(DATEDIFF(end_date, start_date) + 1, 1)
      WHERE total_days IS NULL OR total_days < 1
    `).catch(() => undefined);
  }

  private async seedMissingEmployees(): Promise<void> {
    await this.execute(`
      INSERT IGNORE INTO employees (user_id, department, position, start_date, base_salary)
      SELECT id,
        CASE WHEN role = 'admin' THEN 'Human Resources' ELSE 'Management' END,
        CASE WHEN role = 'admin' THEN 'Administrator' ELSE 'Staff' END,
        DATE(created_at),
        0
      FROM users
    `);
  }
}
