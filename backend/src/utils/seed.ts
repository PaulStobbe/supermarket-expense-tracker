#!/usr/bin/env node
import { initializeDatabase, getDatabase } from '../services/database';

// Sample data for seeding
const sampleUsers = [
  {
    google_id: 'sample_google_id_1',
    email: 'demo@example.com',
    name: 'Demo User',
    picture: 'https://via.placeholder.com/150'
  }
];

const sampleExpenses = [
  {
    store_name: 'Whole Foods',
    category: 'Groceries',
    amount: 45.67,
    description: 'Weekly grocery shopping',
    purchase_date: '2024-05-25',
    tags: JSON.stringify(['organic', 'weekly'])
  },
  {
    store_name: 'Target',
    category: 'Household',
    amount: 23.99,
    description: 'Cleaning supplies',
    purchase_date: '2024-05-24',
    tags: JSON.stringify(['cleaning', 'household'])
  },
  {
    store_name: 'Safeway',
    category: 'Meat & Seafood',
    amount: 28.45,
    description: 'Fresh salmon and chicken',
    purchase_date: '2024-05-23',
    tags: JSON.stringify(['protein', 'fresh'])
  },
  {
    store_name: 'Trader Joes',
    category: 'Snacks',
    amount: 15.32,
    description: 'Trail mix and nuts',
    purchase_date: '2024-05-22',
    tags: JSON.stringify(['healthy', 'snacks'])
  },
  {
    store_name: 'CVS Pharmacy',
    category: 'Health & Beauty',
    amount: 12.99,
    description: 'Shampoo and toothpaste',
    purchase_date: '2024-05-21',
    tags: JSON.stringify(['personal-care'])
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Initialize database
    await initializeDatabase();
    const db = getDatabase();
    
    // Check if data already exists
    const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');
    if (existingUsers.count > 0) {
      console.log('⚠️ Database already contains data. Skipping seeding.');
      process.exit(0);
    }
    
    console.log('Creating sample users...');
    
    // Create sample users
    for (const user of sampleUsers) {
      const result = await db.run(
        'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)',
        [user.google_id, user.email, user.name, user.picture]
      );
      
      const userId = result.lastID!;
      
      // Create user preferences
      await db.run(
        'INSERT INTO user_preferences (user_id) VALUES (?)',
        [userId]
      );
      
      console.log(`Created user: ${user.name} (ID: ${userId})`);
      
      // Create sample expenses for this user
      console.log('Creating sample expenses...');
      for (const expense of sampleExpenses) {
        await db.run(`
          INSERT INTO expenses (user_id, store_name, category, amount, description, purchase_date, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          userId,
          expense.store_name,
          expense.category,
          expense.amount,
          expense.description,
          expense.purchase_date,
          expense.tags
        ]);
      }
      
      console.log(`Created ${sampleExpenses.length} sample expenses`);
    }
    
    // Display summary
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const expenseCount = await db.get('SELECT COUNT(*) as count FROM expenses');
    const categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`✅ Created ${userCount.count} users`);
    console.log(`✅ Created ${expenseCount.count} expenses`);
    console.log(`✅ Available ${categoryCount.count} categories`);
    console.log('\n📝 Sample login credentials:');
    console.log('Email: demo@example.com');
    console.log('Note: Use Google OAuth in the application');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Command line argument handling
const command = process.argv[2];

if (command === '--force') {
  console.log('⚠️ Force seeding enabled. This will clear existing data!');
  // Add force seeding logic here if needed
}

seedDatabase();