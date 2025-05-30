import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './database/expenses.db';

export interface Database {
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  // Ensure database directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new sqlite3.Database(DB_PATH);
  
  // Promisify methods
  const runAsync = promisify(sqlite.run.bind(sqlite));
  const getAsync = promisify(sqlite.get.bind(sqlite));
  const allAsync = promisify(sqlite.all.bind(sqlite));
  const closeAsync = promisify(sqlite.close.bind(sqlite));

  db = {
    run: runAsync,
    get: getAsync,
    all: allAsync,
    close: closeAsync
  };

  // Create tables
  await createTables();
  
  console.log('Database connected and tables created');
  return db;
}

async function createTables(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Expenses table
  await db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      purchase_date DATE NOT NULL,
      receipt_url TEXT,
      tags TEXT, -- JSON array as string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Categories table for predefined categories
  await db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT '🛒',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User preferences table
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      currency TEXT DEFAULT 'USD',
      timezone TEXT DEFAULT 'UTC',
      notification_email BOOLEAN DEFAULT TRUE,
      notification_weekly_summary BOOLEAN DEFAULT TRUE,
      notification_budget_alerts BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Budgets table
  await db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Insert default categories
  const defaultCategories = [
    { name: 'Groceries', color: '#10B981', icon: '🥬' },
    { name: 'Meat & Seafood', color: '#EF4444', icon: '🥩' },
    { name: 'Dairy & Eggs', color: '#F59E0B', icon: '🥛' },
    { name: 'Bakery', color: '#8B5CF6', icon: '🍞' },
    { name: 'Beverages', color: '#06B6D4', icon: '🥤' },
    { name: 'Snacks', color: '#F97316', icon: '🍿' },
    { name: 'Frozen Foods', color: '#3B82F6', icon: '🧊' },
    { name: 'Health & Beauty', color: '#EC4899', icon: '💄' },
    { name: 'Household', color: '#6B7280', icon: '🧽' },
    { name: 'Other', color: '#9CA3AF', icon: '📦' }
  ];

  for (const category of defaultCategories) {
    await db.run(
      'INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)',
      [category.name, category.color, category.icon]
    );
  }

  // Create indexes for better performance
  await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(purchase_date)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// Database utility functions
export class DatabaseUtils {
  static async userExists(googleId: string): Promise<boolean> {
    const database = getDatabase();
    const user = await database.get('SELECT id FROM users WHERE google_id = ?', [googleId]);
    return !!user;
  }

  static async createUser(userData: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<number> {
    const database = getDatabase();
    const result = await database.run(
      'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)',
      [userData.googleId, userData.email, userData.name, userData.picture || null]
    );
    
    // Create default user preferences
    await database.run(
      'INSERT INTO user_preferences (user_id) VALUES (?)',
      [result.lastID]
    );
    
    return result.lastID!;
  }

  static async getUserByGoogleId(googleId: string): Promise<any> {
    const database = getDatabase();
    return await database.get('SELECT * FROM users WHERE google_id = ?', [googleId]);
  }

  static async getUserById(id: number): Promise<any> {
    const database = getDatabase();
    return await database.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async updateUserLastLogin(userId: number): Promise<void> {
    const database = getDatabase();
    await database.run('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
  }
}