import express from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { pool } from '../db.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const router = express.Router();

// Helper untuk WIB
const nowWIB = () => dayjs().tz('Asia/Jakarta');

// Guard middleware
router.use((req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// Ringkasan total bulan
router.get('/summary', async (req, res) => {
  try {
    const now = nowWIB();
    const ym = /^\d{4}-\d{2}$/.test(req.query.ym) ? req.query.ym : now.format('YYYY-MM');

    const start = dayjs.tz(`${ym}-01`, 'Asia/Jakarta').startOf('month');
    const end = start.endOf('month');

    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM savings
       WHERE saved_at BETWEEN ? AND ?`,
      [start.format('YYYY-MM-DD 00:00:00'), end.format('YYYY-MM-DD 23:59:59')]
    );

    res.json({ total: Number(rows[0].total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

// Data kalender bulan
router.get('/calendar', async (req, res) => {
  try {
    const now = nowWIB();
    const ym = /^\d{4}-\d{2}$/.test(req.query.ym) ? req.query.ym : now.format('YYYY-MM');

    const start = dayjs.tz(`${ym}-01`, 'Asia/Jakarta').startOf('month');
    const end = start.endOf('month');

    const [rows] = await pool.query(
      `SELECT DATE(saved_at) AS d, COALESCE(SUM(amount),0) AS s
       FROM savings
       WHERE saved_at BETWEEN ? AND ?
       GROUP BY DATE(saved_at)`,
      [start.format('YYYY-MM-DD 00:00:00'), end.format('YYYY-MM-DD 23:59:59')]
    );

    const map = {};
    rows.forEach(r => {
      map[dayjs(r.d).format('YYYY-MM-DD')] = Number(r.s);
    });

    res.json({
      year: start.year(),
      month: start.month() + 1,
      days: end.date(),
      data: map
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

// Grafik mingguan
router.get('/week', async (req, res) => {
  try {
    const today = nowWIB().startOf('day');
    const start = today.subtract(6, 'day'); // total 7 hari

    const [rows] = await pool.query(
      `SELECT DATE(saved_at) AS d, COALESCE(SUM(amount),0) AS s
       FROM savings
       WHERE saved_at BETWEEN ? AND ?
       GROUP BY DATE(saved_at)`,
      [start.format('YYYY-MM-DD 00:00:00'), today.format('YYYY-MM-DD 23:59:59')]
    );

    const labels = [];
    const values = [];

    for (let i = 0; i < 7; i++) {
      const date = start.add(i, 'day');
      const key = date.format('YYYY-MM-DD');
      const found = rows.find(r => dayjs(r.d).format('YYYY-MM-DD') === key);

      labels.push(date.format('DD/MM'));
      values.push(found ? Number(found.s) : 0);
    }

    res.json({ labels, values });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
});

export default router;
