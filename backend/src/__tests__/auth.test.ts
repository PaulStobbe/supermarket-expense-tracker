import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { initializeDatabase, closeDatabase } from '../services/database';
import { MigrationRunner } from '../utils/migrations';
import { generateTokens, blacklistToken } from '../middleware/auth';
import app from '../server';

describe('Authentication System', () => {
  let testApp: Express;
  let validToken: string;
  let testUserId: number = 1;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
    
    // Initialize test database
    await initializeDatabase();
    await MigrationRunner.runMigrations();
    
    testApp = app;
    
    // Generate a valid token for testing
    const tokens = generateTokens(testUserId);
    validToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token', () => {
      const tokens = generateTokens(123);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.expiresAt).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      
      // Verify token structure
      const decoded = jwt.verify(tokens.accessToken, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(123);
      expect(decoded.iss).toBe('supermarket-expense-tracker');
      expect(decoded.aud).toBe('supermarket-expense-tracker-users');
      expect(decoded.nonce).toBeDefined();
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token', async () => {
      const response = await request(testApp)
        .get('/api/expenses')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(testApp)
        .get('/api/expenses')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        {
          userId: testUserId,
          iss: 'supermarket-expense-tracker',
          aud: 'supermarket-expense-tracker-users',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        process.env.JWT_SECRET!
      );
      
      const response = await request(testApp)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject requests with blacklisted token', async () => {
      const testToken = generateTokens(testUserId).accessToken;
      blacklistToken(testToken);
      
      const response = await request(testApp)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_REVOKED');
    });

    it('should reject tokens with invalid issuer', async () => {
      const invalidToken = jwt.sign(
        {
          userId: testUserId,
          iss: 'wrong-issuer',
          aud: 'supermarket-expense-tracker-users'
        },
        process.env.JWT_SECRET!
      );
      
      const response = await request(testApp)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN_CLAIMS');
    });
  });

  describe('OAuth Flow', () => {
    it('should initiate Google OAuth', async () => {
      const response = await request(testApp)
        .get('/auth/google')
        .expect(302);
      
      expect(response.header.location).toContain('accounts.google.com');
    });

    it('should handle OAuth callback with missing user', async () => {
      const response = await request(testApp)
        .get('/auth/google/callback')
        .expect(302);
      
      expect(response.header.location).toContain('error=no_user');
    });
  });

  describe('API Endpoints', () => {
    it('should return API documentation', async () => {
      const response = await request(testApp)
        .get('/api')
        .expect(200);
      
      expect(response.body.message).toContain('Supermarket Expense Tracker API');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.auth).toBeDefined();
      expect(response.body.endpoints.expenses).toBeDefined();
    });

    it('should return health check', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(testApp)
        .get('/non-existent-route')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(testApp)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      // Should handle JSON parse error gracefully
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);
      
      // Check for security headers set by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });
});

export {};