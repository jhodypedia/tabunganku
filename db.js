import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z' // simpan apa adanya; kita masukkan nilai WIB manual
});

// init table kalau belum ada
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS savings (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      saved_at DATETIME NOT NULL,
      amount BIGINT NOT NULL,
      src VARCHAR(32) NOT NULL,
      raw_text VARCHAR(255) NOT NULL
    )
  `);
}
