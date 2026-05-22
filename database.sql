-- Run this in MySQL to set up the database

CREATE DATABASE IF NOT EXISTS hr_payroll_db;
USE hr_payroll_db;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)        NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,
  role       ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP           DEFAULT CURRENT_TIMESTAMP
);

-- Seed: admin  password = Admin@123
-- Seed: staff  password = Staff@123
-- (bcrypt hashes generated with saltRounds=10)
INSERT INTO users (name, email, password, role) VALUES
  ('Admin User',  'admin@hrpayroll.com', '$2a$10$LCsTsOacvi4HSSsa/KDFreSU1pMBS4Y2SrYNcFUW8X8ClqbMepJl2', 'admin'),
  ('Staff User',  'staff@hrpayroll.com', '$2a$10$9jMV9gJ.2935zC.Ed.naOudF3j58m6PyT83L86zhi6DGrT9CNaZ4u', 'staff')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password = VALUES(password),
  role = VALUES(role);
