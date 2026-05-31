-- Run this in MySQL to set up the database

CREATE DATABASE IF NOT EXISTS hr_payroll_db;
USE hr_payroll_db;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)        NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,
  login_password VARCHAR(255)    NULL,
  role       ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_profiles (
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
);

CREATE TABLE IF NOT EXISTS attendance_records (
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
);

CREATE TABLE IF NOT EXISTS leave_requests (
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
);

CREATE TABLE IF NOT EXISTS payroll_records (
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
);

CREATE TABLE IF NOT EXISTS payroll_settings (
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
);

-- Seed: admin  password = Admin@123
-- Seed: staff  password = Staff@123
-- (bcrypt hashes generated with saltRounds=10)
INSERT INTO users (name, email, password, login_password, role) VALUES
  ('Admin User',  'admin@hrpayroll.com', '$2a$10$LCsTsOacvi4HSSsa/KDFreSU1pMBS4Y2SrYNcFUW8X8ClqbMepJl2', NULL, 'admin'),
  ('Staff User',  'staff@hrpayroll.com', '$2a$10$9jMV9gJ.2935zC.Ed.naOudF3j58m6PyT83L86zhi6DGrT9CNaZ4u', 'Staff@123', 'staff')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password = VALUES(password),
  login_password = VALUES(login_password),
  role = VALUES(role);

INSERT IGNORE INTO employee_profiles (user_id, department, position, start_date, base_salary)
SELECT id,
  CASE WHEN role = 'admin' THEN 'HR' ELSE 'Operations' END,
  CASE WHEN role = 'admin' THEN 'Administrator' ELSE 'Staff' END,
  DATE(created_at),
  CASE WHEN role = 'staff' THEN 500 ELSE 0 END
FROM users;

INSERT INTO payroll_settings
  (user_id, base_salary, housing_allowance, transport_allowance, other_allowances,
   deduction_per_absent_day, deduction_per_late_day, deduction_per_half_day)
SELECT id, 500, 0, 0, 0, 0, 0, 0
FROM users
WHERE role = 'staff'
ON DUPLICATE KEY UPDATE
  base_salary = VALUES(base_salary),
  housing_allowance = VALUES(housing_allowance),
  transport_allowance = VALUES(transport_allowance),
  other_allowances = VALUES(other_allowances),
  deduction_per_absent_day = VALUES(deduction_per_absent_day),
  deduction_per_late_day = VALUES(deduction_per_late_day),
  deduction_per_half_day = VALUES(deduction_per_half_day);
