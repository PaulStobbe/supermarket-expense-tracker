import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { DatabaseUtils } from './database';

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await DatabaseUtils.getUserByGoogleId(profile.id);
    
    if (user) {
      // Update last login
      await DatabaseUtils.updateUserLastLogin(user.id);
      return done(null, user);
    }
    
    // Create new user
    const userData = {
      googleId: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName || 'Unknown User',
      picture: profile.photos?.[0]?.value
    };
    
    const userId = await DatabaseUtils.createUser(userData);
    user = await DatabaseUtils.getUserById(userId);
    
    return done(null, user);
  } catch (error) {
    console.error('Google OAuth Strategy error:', error);
    return done(error, null);
  }
}));

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    ExtractJwt.fromUrlQueryParameter('token'),
    (req) => {
      let token = null;
      if (req && req.cookies) {
        token = req.cookies['jwt'];
      }
      return token;
    }
  ]),
  secretOrKey: process.env.JWT_SECRET!,
  issuer: 'supermarket-expense-tracker',
  audience: 'supermarket-expense-tracker-users'
}, async (jwtPayload, done) => {
  try {
    const user = await DatabaseUtils.getUserById(jwtPayload.userId);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    console.error('JWT Strategy error:', error);
    return done(error, false);
  }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await DatabaseUtils.getUserById(id);
    done(null, user);
  } catch (error) {
    console.error('Deserialize user error:', error);
    done(error, null);
  }
});

export default passport;