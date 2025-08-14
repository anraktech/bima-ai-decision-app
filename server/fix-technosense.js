import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open database
const db = new Database(join(__dirname, 'database.db'));

console.log('Fixing technosense7@gmail.com subscription...');

// Check current status
const user = db.prepare('SELECT id, email, subscription_tier FROM users WHERE email = ?').get('technosense7@gmail.com');
console.log('Current user data:', user);

if (user) {
  // Update to starter
  const result = db.prepare('UPDATE users SET subscription_tier = ? WHERE email = ?').run('starter', 'technosense7@gmail.com');
  console.log('Update result:', result);
  
  // Verify update
  const updated = db.prepare('SELECT id, email, subscription_tier FROM users WHERE email = ?').get('technosense7@gmail.com');
  console.log('Updated user data:', updated);
  
  console.log('✅ User successfully updated to starter plan!');
} else {
  console.log('❌ User not found!');
}

// Also show all users and their plans
console.log('\nAll users and their subscription tiers:');
const allUsers = db.prepare('SELECT email, subscription_tier FROM users').all();
allUsers.forEach(u => {
  console.log(`- ${u.email}: ${u.subscription_tier || 'explore'}`);
});

db.close();