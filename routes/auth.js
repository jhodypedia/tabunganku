import express from 'express';
const router = express.Router();

function mustLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { title: 'Login - WhatsSavings', flash: req.flash('error') });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (
    username === (process.env.ADMIN_USER || 'admin') &&
    password === (process.env.ADMIN_PASS || 'admin123')
  ) {
    req.session.user = { username };
    return res.redirect('/dashboard');
  }
  req.flash('error', 'Username / password salah');
  res.redirect('/login');
});

router.post('/logout', mustLogin, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

export default router;
