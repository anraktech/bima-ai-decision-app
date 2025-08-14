// Script to fix user plan back to free tier
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Connect to the database
const db = new Database(path.join(__dirname, 'server', 'database.db'));

// Find the user
const email = 'kchandwani22@gmail.com';
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (user) {
  console.log('Current user:', user);
  console.log('Current plan:', user.subscription_tier);
  
  // Reset to free plan
  const result = db.prepare('UPDATE users SET subscription_tier = ? WHERE email = ?')
    .run('explore', email);
  
  if (result.changes > 0) {
    console.log('✅ User plan reset to "explore" (free tier)');
    
    // Verify the change
    const updatedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    console.log('Updated plan:', updatedUser.subscription_tier);
  } else {
    console.log('❌ Failed to update user');
  }
} else {
  console.log('❌ User not found');
}

// Also check if there are any subscriptions records
const subscriptions = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(user?.id);
console.log('\nSubscription records:', subscriptions.length);

if (subscriptions.length > 0) {
  // Update subscription status to cancelled for testing
  db.prepare('UPDATE subscriptions SET status = ? WHERE user_id = ?')
    .run('cancelled', user.id);
  console.log('✅ Marked subscriptions as cancelled');
}

db.close();
console.log('\n✅ Database fix complete!');