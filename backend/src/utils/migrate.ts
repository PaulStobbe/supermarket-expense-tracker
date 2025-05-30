#!/usr/bin/env node
import { initializeDatabase } from '../services/database';
import { MigrationRunner } from './migrations';

async function runMigrations() {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Run migrations
    await MigrationRunner.runMigrations();
    
    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackMigration() {
  try {
    const targetVersion = process.argv[3] ? parseInt(process.argv[3]) : undefined;
    
    console.log('🔄 Starting migration rollback...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Rollback migrations
    await MigrationRunner.rollbackMigration(targetVersion);
    
    console.log('✅ Migration rollback completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigrations();
    break;
  case 'rollback':
    rollbackMigration();
    break;
  default:
    console.log(`
Usage:
  npm run db:migrate      - Run pending migrations
  npm run db:rollback     - Rollback last migration
  npm run db:rollback 2   - Rollback to migration version 2
    `);
    process.exit(1);
}