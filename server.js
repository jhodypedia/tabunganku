import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import methodOverride from 'method-override';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import expressLayouts from 'express-ejs-layouts';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { startBaileys } from './baileys.js';
import { ensureSchema } from './db.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout'); // gunakan views/layout.ejs

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session + flash
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12 jam
}));
app.use(flash());

// inject user ke views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.title = 'WhatsSavings';
  next();
});

// Routes
app.use('/', authRoutes);
app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { title: 'Dashboard - WhatsSavings' });
});
app.use('/api', apiRoutes);

// Start
const PORT = process.env.PORT || 3000;
await ensureSchema();
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));

// Start Baileys (QR tampil di terminal)
startBaileys().catch(err => console.error('Gagal start Baileys:', err));
