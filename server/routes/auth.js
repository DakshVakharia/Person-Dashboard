import { Router } from 'express';
import passport from 'passport';
import { db } from '../db.js';

const router = Router();

import { google } from 'googleapis';

// ─── Google OAuth ─────────────────────────────────────────────────────────────

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

router.get('/google', (req, res) => {
  const url = getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) throw new Error(error);

    const { tokens } = await getOAuthClient().getToken(code);
    
    // Save to the single local user
    db.prepare(`
      UPDATE users 
      SET access_token = ?, refresh_token = COALESCE(?, refresh_token) 
      WHERE id = 1
    `).run(tokens.access_token, tokens.refresh_token || null);

    const client = process.env.CLIENT_URL || 'http://localhost:3001';
    res.redirect(client);
  } catch (err) {
    console.error('[Auth Error]', err.message);
    res.redirect('/?error=auth_failed');
  }
});

// ─── Session info ─────────────────────────────────────────────────────────────

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ user: null });
  const { id, email, name, avatar } = req.user;
  res.json({ user: { id, email, name, avatar } });
});

router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

export default router;
