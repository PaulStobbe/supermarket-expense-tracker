import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { DatabaseUtils } from '../services/database';
import { HttpStatus, ErrorMessages } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

// Rate limiting for authentication attempts
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set<string>();

export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
};

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from multiple sources
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      token = req.query.token as string;
    }
    
    if (!token && req.cookies) {
      token = req.cookies.jwt;
    }

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: ErrorMessages.UNAUTHORIZED,
        code: 'NO_TOKEN'
      });
      return;
    }

    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Additional security checks
    if (!decoded.userId || !decoded.iss || !decoded.aud) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
      return;
    }

    // Verify issuer and audience
    if (decoded.iss !== 'supermarket-expense-tracker' || 
        decoded.aud !== 'supermarket-expense-tracker-users') {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'Invalid token issuer or audience',
        code: 'INVALID_TOKEN_CLAIMS'
      });
      return;
    }
    
    // Get user from database
    const user = await DatabaseUtils.getUserById(decoded.userId);
    
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Add user and token to request object for potential blacklisting
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(HttpStatus.UNAUTHORIZED).json({ 
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      console.error('Authentication error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        success: false,
        message: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  }
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(HttpStatus.UNAUTHORIZED).json({ 
    success: false,
    message: ErrorMessages.UNAUTHORIZED
  });
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      token = req.query.token as string;
    }
    
    if (!token && req.cookies) {
      token = req.cookies.jwt;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await DatabaseUtils.getUserById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};


export const revokeToken = (req: AuthenticatedRequest, res: Response): void => {
  const token = req.token;
  
  // Add token to blacklist
  if (token) {
    blacklistToken(token);
  }
  
  // Clear JWT cookie if it exists
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  
  res.json({ 
    success: true,
    message: 'Token revoked successfully.' 
  });
};

// Enhanced token generation with better security
export const generateTokens = (userId: number) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    iss: 'supermarket-expense-tracker',
    aud: 'supermarket-expense-tracker-users',
    iat: now,
    // Add a random nonce for additional security
    nonce: Math.random().toString(36).substring(2, 15)
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  });

  return { 
    accessToken,
    expiresAt: now + (7 * 24 * 60 * 60) // 7 days in seconds
  };
};

// Middleware to check user permissions
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    
    // In this simple app, all authenticated users have the same permissions
    // In a more complex app, you'd check user roles/permissions here
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED
      });
      return;
    }
    
    next();
  };
};

// Middleware to validate user ownership of resources
export const requireOwnership = (resourceUserIdParam: string = 'user_id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    const resourceUserId = req.params[resourceUserIdParam] || req.body[resourceUserIdParam];
    
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED
      });
      return;
    }
    
    if (resourceUserId && parseInt(resourceUserId) !== user.id) {
      res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        message: ErrorMessages.FORBIDDEN
      });
      return;
    }
    
    next();
  };
};