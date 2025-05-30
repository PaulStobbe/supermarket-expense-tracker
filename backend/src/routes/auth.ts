import express from 'express';
import passport from 'passport';
import { generateTokens, requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// @desc    Initiate Google OAuth
// @route   GET /auth/google
// @access  Public
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// @desc    Google OAuth callback
// @route   GET /auth/google/callback
// @access  Public
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    session: true
  }),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user`);
      }

      // Generate JWT token
      const { accessToken } = generateTokens(user.id);

      // Set secure HTTP-only cookie
      res.cookie('jwt', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
    }
  })
);

// @desc    Get current user
// @route   GET /auth/user
// @access  Private
router.get('/user', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }
  });
}));

// @desc    Logout user
// @route   POST /auth/logout
// @access  Private
router.post('/logout', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    // Clear the JWT cookie
    res.clearCookie('jwt');
    
    // Logout from session
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
}));

// @desc    Check authentication status
// @route   GET /auth/status
// @access  Public
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    // Try to authenticate with JWT
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token && req.cookies) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    // Verify token and get user (similar to auth middleware but non-blocking)
    const jwt = require('jsonwebtoken');
    const { DatabaseUtils } = require('../services/database');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await DatabaseUtils.getUserById(decoded.userId);

    if (!user) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    res.json({
      success: true,
      authenticated: false,
      user: null
    });
  }
}));

// @desc    Refresh token
// @route   POST /auth/refresh
// @access  Private
router.post('/refresh', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const { accessToken } = generateTokens(user.id);

    // Set new cookie
    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: accessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
}));

export default router;