import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db.js';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.file',
  ],
  accessType: 'offline',
  prompt: 'consent',
}, (accessToken, refreshToken, profile, done) => {
  try {
    // Get the single local user
    const localUser = db.prepare('SELECT * FROM users LIMIT 1').get();
    
    if (localUser) {
      db.prepare(`
        UPDATE users SET access_token = ?, refresh_token = COALESCE(?, refresh_token)
        WHERE id = ?
      `).run(accessToken, refreshToken || null, localUser.id);
      
      const updatedUser = db.prepare('SELECT * FROM users LIMIT 1').get();
      return done(null, updatedUser);
    }

    done(null, false, { message: 'Local user not found' });
  } catch (err) {
    done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user || false);
});
