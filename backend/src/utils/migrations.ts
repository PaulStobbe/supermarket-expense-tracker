import { getDatabase } from '../services/database';
import fs from 'fs';
import path from 'path';

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export class MigrationRunner {
  private static async ensureMigrationsTable(): Promise<void> {
    const db = getDatabase();
    await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private static async getExecutedMigrations(): Promise<number[]> {
    const db = getDatabase();
    const migrations = await db.all('SELECT version FROM migrations ORDER BY version');
    return migrations.map(m => m.version);
  }

  private static async recordMigration(version: number, name: string): Promise<void> {
    const db = getDatabase();
    await db.run('INSERT INTO migrations (version, name) VALUES (?, ?)', [version, name]);
  }

  private static async removeMigration(version: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM migrations WHERE version = ?', [version]);
  }

  static async runMigrations(): Promise<void> {
    await this.ensureMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    
    const migrations = await this.getAllMigrations();
    const pendingMigrations = migrations.filter(m => !executedMigrations.includes(m.version));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} migrations...`);
    
    for (const migration of pendingMigrations) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up();
        await this.recordMigration(migration.version, migration.name);
        console.log(`✓ Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`✗ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
    
    console.log('All migrations completed successfully');
  }

  static async rollbackMigration(targetVersion?: number): Promise<void> {
    await this.ensureMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const migrations = await this.getAllMigrations();
    const lastExecuted = Math.max(...executedMigrations);
    const rollbackTo = targetVersion || (executedMigrations[executedMigrations.length - 2] || 0);

    const migrationsToRollback = migrations
      .filter(m => m.version > rollbackTo && m.version <= lastExecuted)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback

    if (migrationsToRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    console.log(`Rolling back ${migrationsToRollback.length} migrations...`);
    
    for (const migration of migrationsToRollback) {
      try {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down();
        await this.removeMigration(migration.version);
        console.log(`✓ Rollback ${migration.version} completed`);
      } catch (error) {
        console.error(`✗ Rollback ${migration.version} failed:`, error);
        throw error;
      }
    }
    
    console.log('Rollback completed successfully');
  }

  private static async getAllMigrations(): Promise<Migration[]> {
    const db = getDatabase();
    
    return [
      {
        version: 1,
        name: 'initial_schema',
        up: async () => {
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
              tags TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
          `);

          // Categories table
          await db.run(`
            CREATE TABLE IF NOT EXISTS categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT UNIQUE NOT NULL,
              color TEXT DEFAULT '#3B82F6',
              icon TEXT DEFAULT '🛒',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
        },
        down: async () => {
          await db.run('DROP TABLE IF EXISTS expenses');
          await db.run('DROP TABLE IF EXISTS categories');
          await db.run('DROP TABLE IF EXISTS users');
        }
      },
      {
        version: 2,
        name: 'user_preferences_and_budgets',
        up: async () => {
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
        },
        down: async () => {
          await db.run('DROP TABLE IF EXISTS budgets');
          await db.run('DROP TABLE IF EXISTS user_preferences');
        }
      },
      {
        version: 3,
        name: 'add_indexes',
        up: async () => {
          // Create indexes for better performance
          await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(purchase_date)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)');
          await db.run('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)');
        },
        down: async () => {
          await db.run('DROP INDEX IF EXISTS idx_expenses_user_id');
          await db.run('DROP INDEX IF EXISTS idx_expenses_date');
          await db.run('DROP INDEX IF EXISTS idx_expenses_category');
          await db.run('DROP INDEX IF EXISTS idx_users_google_id');
          await db.run('DROP INDEX IF EXISTS idx_users_email');
          await db.run('DROP INDEX IF EXISTS idx_budgets_user_id');
          await db.run('DROP INDEX IF EXISTS idx_user_preferences_user_id');
        }
      },
      {
        version: 4,
        name: 'seed_default_categories',
        up: async () => {
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
        },
        down: async () => {
          await db.run('DELETE FROM categories');
        }
      }
    ];
  }
}

export default MigrationRunner;