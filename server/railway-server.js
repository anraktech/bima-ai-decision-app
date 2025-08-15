import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import multer from 'multer';
import mammoth from 'mammoth';
import Stripe from 'stripe';
import { sendAdminNotification, sendWelcomeEmail, testEmailConfiguration } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const google = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const xai = process.env.XAI_API_KEY ? new OpenAI({ 
  apiKey: process.env.XAI_API_KEY, 
  baseURL: 'https://api.x.ai/v1' 
}) : null;
const deepseek = process.env.DEEPSEEK_API_KEY ? new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY, 
  baseURL: 'https://api.deepseek.com' 
}) : null;
const openrouter = process.env.OPENROUTER_API_KEY ? new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
}) : null;

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
}) : null;

if (!stripe) {
  console.warn('⚠️  Stripe not configured - payment features will be disabled');
} else {
  console.log('✅ Stripe configured successfully');
}

// Database setup - use persistent volume in production
// On Railway, use /data mount path, otherwise use current directory
const dbDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || 
              (process.env.RAILWAY_ENVIRONMENT ? '/data' : __dirname);
const dbPath = join(dbDir, 'database.db');

// Create directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created database directory:', dbDir);
}

console.log('Database configuration:');
console.log('- Environment:', process.env.NODE_ENV || 'development');
console.log('- Volume mount path:', process.env.RAILWAY_VOLUME_MOUNT_PATH || 'NOT SET');
console.log('- Database directory:', dbDir);
console.log('- Database file path:', dbPath);
console.log('- Database file exists:', fs.existsSync(dbPath));

// Initialize database with better error handling
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Database connection established');
  
  // Test database write/read
  const testQuery = db.prepare('SELECT 1 as test').get();
  console.log('✅ Database test query successful:', testQuery);
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

// Create tables with better error handling
try {
  console.log('Creating database tables...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      subscription_tier TEXT DEFAULT 'explore',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Check if users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log('✅ Users table ready, current users:', userCount.count);
} catch (error) {
  console.error('❌ Failed to create users table:', error);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    base_model TEXT NOT NULL,
    system_prompt TEXT,
    greeting_message TEXT,
    is_shared INTEGER DEFAULT 0,
    share_token TEXT,
    share_count INTEGER DEFAULT 0,
    is_imported INTEGER DEFAULT 0,
    original_model_id INTEGER,
    original_owner_name TEXT,
    original_owner_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Migration: Add sharing columns to existing models table if they don't exist
try {
  // Check if share_token column exists
  const columns = db.prepare("PRAGMA table_info(models)").all();
  const hasShareToken = columns.some(col => col.name === 'share_token');
  
  if (!hasShareToken) {
    console.log('🔄 Adding sharing columns to existing models table...');
    
    // Add columns one by one (can't add UNIQUE constraint with ALTER TABLE)
    db.exec('ALTER TABLE models ADD COLUMN share_token TEXT');
    db.exec('ALTER TABLE models ADD COLUMN share_count INTEGER DEFAULT 0');
    db.exec('ALTER TABLE models ADD COLUMN is_imported INTEGER DEFAULT 0');
    db.exec('ALTER TABLE models ADD COLUMN original_model_id INTEGER');
    db.exec('ALTER TABLE models ADD COLUMN original_owner_name TEXT');
    db.exec('ALTER TABLE models ADD COLUMN original_owner_email TEXT');
    
    console.log('✅ Sharing columns added successfully');
  } else {
    console.log('ℹ️  Sharing columns already exist');
  }
} catch (error) {
  console.error('❌ Migration error:', error.message);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id TEXT,
    model_name TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id INTEGER,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
  )
`);

// Document storage tables
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    model_token TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS community_post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    UNIQUE(user_id, post_id)
  )
`);

// Subscription management tables
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_type TEXT NOT NULL DEFAULT 'explore',
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end INTEGER DEFAULT 0,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    stripe_price_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_usage_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER NOT NULL,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    tokens_limit INTEGER NOT NULL,
    cost_incurred REAL DEFAULT 0.0,
    plan_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscription_renewals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER NOT NULL,
    old_period_end DATETIME NOT NULL,
    new_period_start DATETIME NOT NULL,
    new_period_end DATETIME NOT NULL,
    plan_type TEXT NOT NULL,
    renewal_type TEXT DEFAULT 'automatic',
    stripe_invoice_id TEXT,
    amount_paid REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  )
`);

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_user_id ON community_post_likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_post_id ON community_post_likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
  CREATE INDEX IF NOT EXISTS idx_usage_periods_user_id ON subscription_usage_periods(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_periods_dates ON subscription_usage_periods(period_start, period_end);
  CREATE INDEX IF NOT EXISTS idx_renewals_user_id ON subscription_renewals(user_id);
`);

// Migration: Create default subscriptions for existing users who don't have them
try {
  console.log('🔄 Checking for users without subscriptions...');
  
  const usersWithoutSubs = db.prepare(`
    SELECT u.id, u.email, u.name, u.subscription_tier 
    FROM users u 
    LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
    WHERE s.id IS NULL
  `).all();
  
  if (usersWithoutSubs.length > 0) {
    console.log(`📝 Creating default subscriptions for ${usersWithoutSubs.length} existing users...`);
    
    const createDefaultSub = db.transaction((user) => {
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const planType = user.subscription_tier || 'explore';
      
      const planLimits = {
        explore: { tokens: 50000, price: 0 },
        starter: { tokens: 250000, price: 19 },
        professional: { tokens: 750000, price: 49 },
        enterprise: { tokens: 3000000, price: 199 }
      };
      
      // Create subscription
      const subResult = db.prepare(`
        INSERT INTO subscriptions (
          user_id, plan_type, status, current_period_start, current_period_end
        ) VALUES (?, ?, ?, ?, ?)
      `).run(user.id, planType, 'active', now.toISOString(), monthEnd.toISOString());
      
      // Create usage period
      db.prepare(`
        INSERT INTO subscription_usage_periods (
          user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, subResult.lastInsertRowid, now.toISOString(), monthEnd.toISOString(), 0, planLimits[planType].tokens, planType);
      
      return subResult.lastInsertRowid;
    });
    
    for (const user of usersWithoutSubs) {
      try {
        const subId = createDefaultSub(user);
        console.log(`✅ Created subscription ${subId} for user ${user.email} (${user.subscription_tier || 'explore'} plan)`);
      } catch (error) {
        console.error(`❌ Failed to create subscription for user ${user.email}:`, error.message);
      }
    }
    
    console.log('✅ Default subscription migration completed');
  } else {
    console.log('ℹ️  All users already have subscriptions');
  }
} catch (error) {
  console.error('❌ Subscription migration error:', error.message);
}

// CORS configuration for production
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://anrak.tech',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// ========== STRIPE WEBHOOKS (BEFORE BODY PARSING) ==========
// Stripe webhook endpoint - MUST be before express.json() middleware
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log('📧 Stripe webhook received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
        
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.use(express.json());

// Auth middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database to ensure they still exist
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Multer configuration for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'text/rtf'];
    const allowedExtensions = ['pdf', 'docx', 'rtf'];
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || (extension && allowedExtensions.includes(extension))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and RTF files are allowed.'));
    }
  }
});

// Advanced text extraction function for PDF, DOCX, and RTF files
const extractText = async (buffer, filename) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  try {
    switch (extension) {
      case 'pdf':
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
        
      case 'docx':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;
        
      case 'rtf':
        // Basic RTF processing - extract text content
        const rtfText = buffer.toString('utf-8');
        // Simple RTF text extraction (remove RTF formatting codes)
        const cleanText = rtfText.replace(/\\[a-z0-9]+\s?/gi, '').replace(/[{}]/g, '').trim();
        return cleanText || `RTF document: ${filename}`;
        
      case 'txt':
        return buffer.toString('utf-8');
        
      default:
        throw new Error(`Unsupported file type: ${extension}. Only PDF, DOCX, RTF, and TXT files are supported.`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filename}:`, error);
    throw new Error(`Failed to process ${filename}: ${error.message}`);
  }
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Get full user from database
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  });
};

// Generate share token for model sharing
const generateShareToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) token += '-';
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Enhanced health check with OpenRouter status
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    openrouterConfigured: !!process.env.OPENROUTER_API_KEY
  });
});

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasGoogle: !!process.env.GOOGLE_API_KEY,
      hasGroq: !!process.env.GROQ_API_KEY,
      hasXAI: !!process.env.XAI_API_KEY,
      hasDeepseek: !!process.env.DEEPSEEK_API_KEY,
      hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
      openrouterKeyPrefix: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.substring(0, 12) + '...' : 'NOT_SET',
      volumeMount: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'NOT_SET',
      nodeEnv: process.env.NODE_ENV || 'NOT_SET'
    }
  });
});

// Database admin endpoints for Railway database viewing
app.get('/api/admin/tables', (req, res) => {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    res.json({
      success: true,
      tables: tables.map(t => t.name),
      database_path: dbPath,
      instructions: {
        railway_access: "Go to Railway Dashboard > Your Project > Data tab to access the database browser",
        api_endpoints: [
          "GET /api/admin/tables - List all tables",
          "GET /api/admin/table/:name - View table data",
          "GET /api/admin/stats - Database statistics"
        ]
      }
    });
  } catch (error) {
    console.error('Admin tables error:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

app.get('/api/admin/table/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    // Validate table name to prevent SQL injection
    const validTables = ['users', 'models', 'documents', 'token_usage', 'conversations'];
    if (!validTables.includes(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const data = db.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT ?`).all(limit);
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    
    res.json({
      success: true,
      table: tableName,
      count: count.count,
      limit: limit,
      data: data
    });
  } catch (error) {
    console.error('Admin table error:', error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
});

app.get('/api/admin/stats', (req, res) => {
  try {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      models: db.prepare('SELECT COUNT(*) as count FROM models').get(),
      documents: db.prepare('SELECT COUNT(*) as count FROM documents').get(),
      conversations: db.prepare('SELECT COUNT(*) as count FROM conversations').get(),
      token_usage: db.prepare('SELECT COUNT(*) as count FROM token_usage').get(),
      recent_activity: {
        recent_users: db.prepare('SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 5').all(),
        recent_models: db.prepare('SELECT name, created_at FROM models ORDER BY created_at DESC LIMIT 5').all(),
        recent_documents: db.prepare('SELECT original_name, created_at FROM documents ORDER BY created_at DESC LIMIT 5').all()
      }
    };
    
    res.json({
      success: true,
      database_stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name);
    
    // Create default subscription for new user (Explore plan)
    const userId = result.lastInsertRowid;
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    const subscriptionResult = db.prepare(`
      INSERT INTO subscriptions (
        user_id, plan_type, status, current_period_start, current_period_end
      ) VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'explore', 'active', now.toISOString(), monthEnd.toISOString());
    
    // Create initial usage period
    db.prepare(`
      INSERT INTO subscription_usage_periods (
        user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, subscriptionResult.lastInsertRowid, now.toISOString(), monthEnd.toISOString(), 0, 50000, 'explore');
    
    const token = jwt.sign({ userId: userId, email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({ 
      token, 
      user: { 
        id: result.lastInsertRowid, 
        email, 
        name,
        subscription_tier: 'explore'
      } 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        subscription_tier: user.subscription_tier || 'explore'
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, name, subscription_tier FROM users WHERE id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Models endpoints - Enhanced to include document content in system instructions
app.get('/api/models', authenticateToken, (req, res) => {
  try {
    const models = db.prepare('SELECT * FROM models WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
    
    // Enhance each model with document content appended to system instructions
    const enhancedModels = models.map(model => {
      try {
        // Fetch documents for this model
        const documents = db.prepare(`
          SELECT content, original_name 
          FROM documents 
          WHERE model_id = ? AND user_id = ?
          ORDER BY created_at ASC
        `).all(model.id, req.user.userId);
        
        let enhancedSystemInstructions = model.system_instructions || model.system_prompt || '';
        
        // Append document content if documents exist
        if (documents.length > 0) {
          const documentContent = documents.map(doc => {
            return `\n\n=== KNOWLEDGE BASE DOCUMENT: ${doc.original_name} ===\n${doc.content}\n=== END DOCUMENT ===`;
          }).join('');
          
          enhancedSystemInstructions += `\n\n=== KNOWLEDGE BASE ===\nYou have access to the following documents that contain additional context and information. Reference this knowledge when relevant to the conversation:${documentContent}\n\n=== END KNOWLEDGE BASE ===\n\nPlease use the information from these documents to provide more accurate and detailed responses when relevant.`;
        }
        
        return {
          ...model,
          system_instructions: enhancedSystemInstructions,
          system_prompt: enhancedSystemInstructions, // Support both field names
          document_count: documents.length
        };
      } catch (docError) {
        console.error(`Error fetching documents for model ${model.id}:`, docError);
        return model; // Return original model if document fetching fails
      }
    });
    
    res.json(enhancedModels);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Model providers endpoint (MUST be before /api/models/:id to avoid conflicts)
app.get('/api/models/providers', async (req, res) => {
  try {
    let providers = [];

    // Add OpenRouter first if key is available
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          // 🔥 FLAGSHIP PREMIUM MODELS (LATEST & GREATEST) 🔥
          
          // GPT-5 MODELS (NEWEST OPENAI)
          { id: 'openai/gpt-5-chat', name: '🚀 GPT-5 Chat (Latest)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'openai/gpt-5-mini', name: '⚡ GPT-5 Mini (Fast)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'openai/gpt-5-nano', name: '💨 GPT-5 Nano (Ultra Fast)', provider: 'openrouter', requiresKey: true, context: 200000 },
          
          // CLAUDE OPUS & SONNET 4 (NEWEST ANTHROPIC)
          { id: 'anthropic/claude-opus-4.1', name: '🧠 Claude Opus 4.1 (Ultimate)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'anthropic/claude-opus-4', name: '🎯 Claude Opus 4 (Powerful)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'anthropic/claude-sonnet-4', name: '⚡ Claude Sonnet 4 (Balanced)', provider: 'openrouter', requiresKey: true, context: 200000 },
          
          // GEMINI 2.5 MODELS (NEWEST GOOGLE)
          { id: 'google/gemini-2.5-pro', name: '💎 Gemini 2.5 Pro (Ultimate)', provider: 'openrouter', requiresKey: true, context: 2000000 },
          { id: 'google/gemini-2.5-flash', name: '⚡ Gemini 2.5 Flash (Lightning)', provider: 'openrouter', requiresKey: true, context: 1000000 },
          { id: 'google/gemini-2.5-pro-exp-03-25', name: '🧪 Gemini 2.5 Pro Experimental', provider: 'openrouter', requiresKey: true, context: 2000000 },
          
          // GROK 3 & 4 MODELS (NEWEST XAI)
          { id: 'x-ai/grok-4', name: '🔥 Grok 4 (Latest)', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'x-ai/grok-3', name: '🚀 Grok 3 (Advanced)', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'x-ai/grok-3-mini', name: '⚡ Grok 3 Mini (Fast)', provider: 'openrouter', requiresKey: true, context: 131072 },
          
          // EXISTING PREMIUM MODELS
          { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'mistralai/codestral-2508', name: 'Codestral 2508 (Code)', provider: 'openrouter', requiresKey: true, context: 32768 },
          { id: 'mistralai/pixtral-large-2411', name: 'Pixtral Large (Vision)', provider: 'openrouter', requiresKey: true, context: 128000 },
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'cohere/command-r-plus-08-2024', name: 'Cohere Command R+', provider: 'openrouter', requiresKey: true, context: 128000 },
          { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (Largest)', provider: 'openrouter', requiresKey: true, context: 131072 }
        ]
      });
    }

    // Add other providers
    providers = providers.concat([
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o (Latest)', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'o1-pro', name: 'OpenAI o1 Pro (Reasoning)', provider: 'openai', requiresKey: true, context: 200000 },
          { id: 'o1', name: 'OpenAI o1 (Reasoning)', provider: 'openai', requiresKey: true, context: 200000 },
          { id: 'o1-mini', name: 'OpenAI o1 Mini (Reasoning)', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', requiresKey: true, context: 8192 },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', requiresKey: true, context: 16385 }
        ]
      },
      {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        models: [
          { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1 (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', requiresKey: true, context: 200000 }
        ]
      },
      {
        id: 'groq',
        name: 'Groq',
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Latest)', provider: 'groq', requiresKey: true, context: 131072 },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', requiresKey: true, context: 131072 }
        ]
      },
      {
        id: 'google',
        name: 'Google (Gemini)',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', requiresKey: true, context: 2000000 },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', requiresKey: true, context: 1000000 },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', provider: 'google', requiresKey: true, context: 1000000 }
        ]
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        models: [
          { id: 'grok-2-1212', name: 'Grok 2 (Latest)', provider: 'xai', requiresKey: true, context: 131072 },
          { id: 'grok-2-vision-1212', name: 'Grok 2 Vision (Latest)', provider: 'xai', requiresKey: true, context: 131072 }
        ]
      },
      {
        id: 'deepseek',
        name: 'Deepseek',
        models: [
          { id: 'deepseek-chat', name: 'Deepseek Chat (Latest)', provider: 'deepseek', requiresKey: true, context: 32768 },
          { id: 'deepseek-coder', name: 'Deepseek Coder', provider: 'deepseek', requiresKey: true, context: 16384 }
        ]
      }
    ]);

    // Check which API keys are available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasXAI = !!process.env.XAI_API_KEY;
    const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    // Filter providers based on available keys
    const availableProviders = providers.filter(provider => {
      if (provider.name === 'OpenAI') return hasOpenAI;
      if (provider.name === 'Anthropic (Claude)') return hasAnthropic;
      if (provider.name === 'Google (Gemini)') return hasGoogle;
      if (provider.name === 'Groq') return hasGroq;
      if (provider.name === 'xAI (Grok)') return hasXAI;
      if (provider.name === 'Deepseek') return hasDeepseek;
      if (provider.id === 'openrouter') return hasOpenRouter;
      return false;
    });

    res.json({ 
      success: true, 
      providers: availableProviders 
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get single model by ID
app.get('/api/models/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching model:', id, 'for user:', req.user.userId);
    
    const model = db.prepare('SELECT * FROM models WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Fetch documents for this model to include in system instructions
    const documents = db.prepare(`
      SELECT id, original_name, file_type, file_size, content, created_at
      FROM documents 
      WHERE model_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `).all(id, req.user.userId);
    
    let enhancedSystemInstructions = model.system_instructions || model.system_prompt || '';
    
    // Append document content if documents exist  
    if (documents.length > 0) {
      const documentContent = documents.map(doc => {
        return `\n\n=== KNOWLEDGE BASE DOCUMENT: ${doc.original_name} ===\n${doc.content}\n=== END DOCUMENT ===`;
      }).join('');
      
      enhancedSystemInstructions += `\n\n=== KNOWLEDGE BASE ===\nYou have access to the following documents that contain additional context and information. Reference this knowledge when relevant to the conversation:${documentContent}\n\n=== END KNOWLEDGE BASE ===\n\nPlease use the information from these documents to provide more accurate and detailed responses when relevant.`;
    }
    
    // Normalize field names for frontend compatibility and include enhanced system instructions
    const responseModel = {
      ...model,
      system_instructions: enhancedSystemInstructions,
      system_prompt: enhancedSystemInstructions,
      opening_statement: model.greeting_message,
      document_count: documents.length,
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.original_name,
        original_name: doc.original_name,
        file_type: doc.file_type,
        size: doc.file_size,
        created_at: doc.created_at
      }))
    };
    
    console.log('✅ Model found:', model.name, 'with', documents.length, 'documents');
    res.json(responseModel);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

app.post('/api/models', authenticateToken, (req, res) => {
  try {
    console.log('📝 Custom model creation request:', JSON.stringify(req.body, null, 2));
    const { name, baseModel, base_model, systemInstructions, system_prompt, openingStatement, greeting_message } = req.body;
    
    // Support both camelCase and snake_case field names
    const modelName = name;
    const modelBaseModel = baseModel || base_model;
    const modelSystemPrompt = systemInstructions || system_prompt;
    const modelGreetingMessage = openingStatement || greeting_message;
    
    if (!modelName || !modelBaseModel) {
      console.log('❌ Missing required fields - name:', !!modelName, 'baseModel:', !!modelBaseModel);
      return res.status(400).json({ error: 'Name and base model are required' });
    }
    
    const result = db.prepare(
      'INSERT INTO models (user_id, name, base_model, system_prompt, greeting_message) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.userId, modelName, modelBaseModel, modelSystemPrompt || '', modelGreetingMessage || '');
    
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

// Update model by ID
app.put('/api/models/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Updating model:', id, 'with data:', JSON.stringify(req.body, null, 2));
    
    const { name, baseModel, base_model, systemInstructions, system_prompt, openingStatement, greeting_message } = req.body;
    
    // Support both camelCase and snake_case field names
    const modelName = name;
    const modelBaseModel = baseModel || base_model;
    const modelSystemPrompt = systemInstructions || system_prompt;
    const modelGreetingMessage = openingStatement || greeting_message;
    
    // Verify the model belongs to the user
    const existingModel = db.prepare('SELECT * FROM models WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!existingModel) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (!modelName || !modelBaseModel) {
      console.log('❌ Missing required fields - name:', !!modelName, 'baseModel:', !!modelBaseModel);
      return res.status(400).json({ error: 'Name and base model are required' });
    }
    
    // Update the model
    db.prepare(
      'UPDATE models SET name = ?, base_model = ?, system_prompt = ?, greeting_message = ? WHERE id = ? AND user_id = ?'
    ).run(modelName, modelBaseModel, modelSystemPrompt || '', modelGreetingMessage || '', id, req.user.userId);
    
    // Fetch updated model
    const updatedModel = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
    const docCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE model_id = ?').get(id);
    
    const responseModel = {
      ...updatedModel,
      system_instructions: updatedModel.system_prompt,
      opening_statement: updatedModel.greeting_message,
      document_count: docCount.count
    };
    
    console.log('✅ Model updated:', modelName);
    res.json(responseModel);
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

// Share model endpoint - Generate share token and make model public
app.post('/api/models/:id/share', authenticateToken, (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.userId
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Generate share token if not exists, otherwise reuse existing token
    let shareToken = model.share_token;
    if (!shareToken) {
      shareToken = generateShareToken();
      db.prepare('UPDATE models SET share_token = ?, is_shared = 1 WHERE id = ?').run(
        shareToken,
        req.params.id
      );
    } else {
      // Just set is_shared to 1 if token already exists
      db.prepare('UPDATE models SET is_shared = 1 WHERE id = ?').run(req.params.id);
    }

    res.json({ shareToken, message: 'Model is now publicly shareable' });
  } catch (error) {
    console.error('Share model error:', error);
    res.status(500).json({ error: 'Failed to share model' });
  }
});

// Revoke model sharing (but keep the token for future use)
app.delete('/api/models/:id/share', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(
      'UPDATE models SET is_shared = 0 WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    res.json({ message: 'Model sharing revoked' });
  } catch (error) {
    console.error('Revoke share error:', error);
    res.status(500).json({ error: 'Failed to revoke sharing' });
  }
});

// Import a shared model by token
app.post('/api/models/import', authenticateToken, async (req, res) => {
  try {
    const { shareToken } = req.body;

    if (!shareToken) {
      return res.status(400).json({ error: 'Share token is required' });
    }

    // Find the original model
    const originalModel = db.prepare(`
      SELECT m.*, u.name as owner_name, u.email as owner_email
      FROM models m
      JOIN users u ON m.user_id = u.id
      WHERE m.share_token = ? AND m.is_shared = 1
    `).get(shareToken);

    if (!originalModel) {
      return res.status(404).json({ error: 'Invalid share token or model not found' });
    }

    // Check if already imported by looking for existing model with same original_model_id
    const existingImported = db.prepare(`
      SELECT id FROM models 
      WHERE user_id = ? AND original_model_id = ?
    `).get(req.user.userId, originalModel.id);

    if (existingImported) {
      return res.status(400).json({ error: 'Model already imported' });
    }

    // Create a new model for the user (imported copy)
    const importedModelResult = db.prepare(`
      INSERT INTO models (
        user_id, name, base_model, system_prompt, greeting_message, 
        is_imported, original_model_id, original_owner_name, original_owner_email,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      req.user.userId,
      originalModel.name,
      originalModel.base_model,
      originalModel.system_prompt,
      originalModel.greeting_message,
      originalModel.id,
      originalModel.owner_name,
      originalModel.owner_email
    );

    // Copy documents from original model
    const originalDocuments = db.prepare(`
      SELECT * FROM documents WHERE model_id = ?
    `).all(originalModel.id);

    for (const doc of originalDocuments) {
      db.prepare(`
        INSERT INTO documents (
          model_id, user_id, filename, original_name, content, file_type, file_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        importedModelResult.lastInsertRowid,
        req.user.userId,
        doc.filename,
        doc.original_name,
        doc.content,
        doc.file_type,
        doc.file_size
      );
    }

    // Increment share count
    db.prepare('UPDATE models SET share_count = share_count + 1 WHERE id = ?').run(originalModel.id);

    // Get the newly created model with document count
    const importedModel = db.prepare(`
      SELECT m.*, COUNT(d.id) as document_count
      FROM models m
      LEFT JOIN documents d ON m.id = d.model_id
      WHERE m.id = ?
      GROUP BY m.id
    `).get(importedModelResult.lastInsertRowid);

    res.json({
      message: 'Model imported successfully',
      model: importedModel
    });
  } catch (error) {
    console.error('Import model error:', error);
    res.status(500).json({ error: 'Failed to import model' });
  }
});

// Get all imported models for a user
app.get('/api/models/imported', authenticateToken, (req, res) => {
  try {
    const importedModels = db.prepare(`
      SELECT m.*, COUNT(d.id) as document_count
      FROM models m
      LEFT JOIN documents d ON m.id = d.model_id
      WHERE m.user_id = ? AND m.is_imported = 1
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all(req.user.userId);

    res.json(importedModels);
  } catch (error) {
    console.error('Error fetching imported models:', error);
    res.status(500).json({ error: 'Failed to fetch imported models' });
  }
});

// Document upload endpoint  
app.post('/api/models/:modelId/documents', authenticateToken, upload.array('documents', 3), async (req, res) => {
  try {
    const { modelId } = req.params;
    const files = req.files;
    
    console.log('📄 Document upload for model:', modelId, 'Files:', files?.length || 0);
    
    // Verify the model belongs to the user
    const model = db.prepare('SELECT * FROM models WHERE id = ? AND user_id = ?').get(modelId, req.user.userId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Strict file type validation - ONLY PDF, DOCX, and RTF allowed
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/rtf',
      'text/rtf'
    ];
    
    const allowedExtensions = ['pdf', 'docx', 'rtf'];
    
    for (const file of files) {
      const extension = file.originalname.toLowerCase().split('.').pop();
      const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
      const isValidExtension = allowedExtensions.includes(extension);
      
      if (!isValidMimeType && !isValidExtension) {
        return res.status(400).json({ 
          error: `Invalid file type: ${file.originalname}. Only PDF, DOCX, and RTF files are allowed.`,
          accepted_types: 'PDF (.pdf), Microsoft Word (.docx), Rich Text Format (.rtf)'
        });
      }
      
      // Additional size check (10MB limit per file)
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ 
          error: `File too large: ${file.originalname}. Maximum file size is 10MB.`
        });
      }
    }
    
    const results = [];
    
    for (const file of files) {
      try {
        console.log(`📄 Processing ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
        
        // Extract text content from the file
        const content = await extractText(file.buffer, file.originalname);
        
        // Save document to database
        const result = db.prepare(`
          INSERT INTO documents (user_id, model_id, original_name, filename, file_type, file_size, content)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.user.userId,
          modelId,
          file.originalname,
          `${Date.now()}-${file.originalname}`, // Unique filename
          file.mimetype,
          file.size,
          content
        );
        
        results.push({
          id: result.lastInsertRowid,
          original_name: file.originalname,
          file_size: file.size,
          processed: true
        });
        
        console.log('✅ Processed document:', file.originalname);
      } catch (error) {
        console.error('❌ Error processing file:', file.originalname, error);
        results.push({
          original_name: file.originalname,
          error: 'Failed to process file'
        });
      }
    }
    
    res.json({
      success: true,
      message: `Successfully uploaded ${results.filter(r => r.id).length} of ${files.length} documents`,
      documents: results
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get model documents content endpoint
app.get('/api/models/:modelId/documents/content', authenticateToken, (req, res) => {
  try {
    const { modelId } = req.params;
    console.log('📄 Fetching documents for model:', modelId, 'by user:', req.user.userId);
    
    // Verify the model belongs to the user (or is a shared/imported model)
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Check if user owns the model OR if it's a shared model they have access to
    const hasAccess = model.user_id === req.user.userId || model.is_shared;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Fetch documents associated with this model
    const documents = db.prepare(`
      SELECT id, original_name, file_type, file_size, content, created_at
      FROM documents 
      WHERE model_id = ?
      ORDER BY created_at ASC
    `).all(modelId);
    
    console.log(`📄 Found ${documents.length} documents for model ${modelId}`);
    
    res.json(documents);
  } catch (error) {
    console.error('Error fetching model documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Conversations endpoint
app.post('/api/conversations', authenticateToken, (req, res) => {
  try {
    const { model_id, title } = req.body;
    
    const result = db.prepare(
      'INSERT INTO conversations (user_id, model_id, title) VALUES (?, ?, ?)'
    ).run(req.user.userId, model_id || null, title || 'New Conversation');
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      user_id: req.user.userId,
      model_id,
      title: title || 'New Conversation',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Community posts endpoints
app.get('/api/community/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT p.*, 
             u.name as username,
             COALESCE(l.like_count, 0) as likes
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT post_id, COUNT(*) as like_count 
        FROM community_post_likes 
        GROUP BY post_id
      ) l ON p.id = l.post_id
      ORDER BY p.created_at DESC
      LIMIT 50
    `).all();
    
    // Parse tags from JSON string
    const formattedPosts = posts.map(post => ({
      ...post,
      tags: JSON.parse(post.tags || '[]'),
      timestamp: post.created_at
    }));
    
    res.json(formattedPosts);
  } catch (error) {
    console.error('Error fetching community posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/community/posts', authenticateToken, (req, res) => {
  try {
    const { title, description, modelToken, tags } = req.body;
    
    if (!title || !description || !modelToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const tagsJson = JSON.stringify(tags || []);
    
    const result = db.prepare(`
      INSERT INTO community_posts (user_id, username, title, description, model_token, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.userId, req.user.name || 'Anonymous', title, description, modelToken.toUpperCase(), tagsJson);
    
    const newPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(result.lastInsertRowid);
    
    // Format the response
    const formattedPost = {
      ...newPost,
      tags: JSON.parse(newPost.tags || '[]'),
      timestamp: newPost.created_at,
      likes: 0
    };
    
    res.status(201).json(formattedPost);
  } catch (error) {
    console.error('Error creating community post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.post('/api/community/posts/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;
    
    // Check if post exists
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if already liked
    const existingLike = db.prepare('SELECT * FROM community_post_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
    if (existingLike) {
      return res.status(400).json({ error: 'Already liked this post' });
    }
    
    // Add like
    db.prepare('INSERT INTO community_post_likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
    
    // Update likes count
    const likeCount = db.prepare('SELECT COUNT(*) as count FROM community_post_likes WHERE post_id = ?').get(postId).count;
    db.prepare(`
      UPDATE community_posts 
      SET likes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(likeCount, postId);
    
    const updatedPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    res.json({ ...updatedPost, likes: likeCount });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

app.delete('/api/community/posts/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.userId;
    
    // Remove like
    const result = db.prepare('DELETE FROM community_post_likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
    
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Like not found' });
    }
    
    // Update likes count
    const likeCount = db.prepare('SELECT COUNT(*) as count FROM community_post_likes WHERE post_id = ?').get(postId).count;
    db.prepare(`
      UPDATE community_posts 
      SET likes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(likeCount, postId);
    
    const updatedPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    res.json({ ...updatedPost, likes: likeCount });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

app.post('/api/community/posts/:id/view', (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    
    // Increment view count
    db.prepare(`
      UPDATE community_posts 
      SET views = views + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(postId);
    
    const updatedPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post views:', error);
    res.status(500).json({ error: 'Failed to update views' });
  }
});

// Chat completions endpoint - REAL API implementation
app.post('/api/chat/completions', authenticateToken, async (req, res) => {
  try {
    const { model, messages, temperature = 0.7, max_tokens = 1000, provider } = req.body;
    
    console.log(`Chat request - Model: ${model}, Provider: ${provider}, Full body:`, JSON.stringify({model, provider}, null, 2));
    
    // Determine provider from explicit provider field or model ID
    let response;
    
    // Handle OpenRouter models first (based on provider field or model ID pattern)
    const isOpenRouterModel = provider === 'openrouter' || model.includes('/');
    console.log('🔍 OpenRouter Debug Info:');
    console.log('   - provider:', provider);
    console.log('   - model:', model);
    console.log('   - isOpenRouterModel:', isOpenRouterModel);
    console.log('   - openrouter client exists:', !!openrouter);
    console.log('   - OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
    
    if (isOpenRouterModel && openrouter) {
      console.log('Routing to OpenRouter for model:', model);
      console.log('OpenRouter API configured:', !!openrouter);
      try {
        const openrouterResponse = await openrouter.chat.completions.create({
          model: model, // Model IDs like 'openai/gpt-4o', 'microsoft/phi-4-multimodal-instruct', etc.
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
        });
        
        response = openrouterResponse;
        console.log('✅ OpenRouter API success for model:', model);
      } catch (error) {
        console.error('❌ OpenRouter API error for model:', model);
        console.error('   Error status:', error.status);
        console.error('   Error message:', error.message);
        console.error('   Error details:', JSON.stringify(error.error || {}, null, 2));
        
        // Handle specific OpenRouter error types
        if (error.status === 400) {
          return res.status(400).json({ 
            error: 'Invalid model or request. Check model ID format.',
            details: `The model "${model}" failed with 400 error. Message: ${error.message}`,
            provider: 'OpenRouter',
            debugInfo: {
              modelId: model,
              errorStatus: error.status,
              errorMessage: error.message
            }
          });
        } else if (error.status === 401) {
          return res.status(401).json({ 
            error: 'OpenRouter API key is invalid or expired.',
            details: error.message || 'Check your OpenRouter API key configuration',
            provider: 'OpenRouter'
          });
        } else if (error.status === 429) {
          return res.status(429).json({ 
            error: 'OpenRouter API rate limit exceeded.',
            details: error.message || 'Too many requests, please try again later',
            provider: 'OpenRouter'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to generate response from OpenRouter',
            details: error.message || 'Unknown error',
            provider: 'OpenRouter'
          });
        }
      }
    } else if (model.includes('gpt') && openai) {
      // OpenAI API call
      try {
        const completion = await openai.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
        });
        
        response = completion;
      } catch (error) {
        console.error('OpenAI API error:', error);
        
        // Handle specific OpenAI error types
        if (error.status === 429) {
          return res.status(429).json({ 
            error: 'OpenAI API quota exceeded. Please check your OpenAI billing plan and usage limits.',
            details: error.error?.message || 'Rate limit exceeded'
          });
        } else if (error.status === 401) {
          return res.status(500).json({ 
            error: 'OpenAI API key is invalid or expired. Please check your API key configuration.',
            details: error.error?.message || 'Authentication failed'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to generate response from OpenAI',
            details: error.error?.message || error.message || 'Unknown error'
          });
        }
      }
    } else if (model.includes('claude') && anthropic) {
      // Real Anthropic API call
      try {
        const anthropicResponse = await anthropic.messages.create({
          model: model,
          max_tokens: max_tokens,
          temperature: temperature,
          messages: messages.filter(msg => msg.role !== 'system').map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          system: messages.find(msg => msg.role === 'system')?.content
        });
        
        response = {
          id: 'claude-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: anthropicResponse.content[0].text
            },
            finish_reason: 'stop'
          }],
          usage: { 
            prompt_tokens: anthropicResponse.usage.input_tokens,
            completion_tokens: anthropicResponse.usage.output_tokens,
            total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens
          }
        };
      } catch (error) {
        console.error('Anthropic API error:', error);
        return res.status(500).json({ 
          error: 'Failed to generate response from Anthropic',
          details: error.message || 'Unknown error'
        });
      }
    } else if (model.includes('gemini') && google) {
      // Real Google Gemini API call
      try {
        const geminiModel = google.getGenerativeModel({ model: model });
        
        // Convert messages to Gemini format
        const systemMessage = messages.find(msg => msg.role === 'system');
        const userMessages = messages.filter(msg => msg.role !== 'system');
        
        let prompt = '';
        if (systemMessage) {
          prompt += `Instructions: ${systemMessage.content}\n\n`;
        }
        
        // Build conversation history for Gemini
        userMessages.forEach(msg => {
          if (msg.role === 'user') {
            prompt += `User: ${msg.content}\n`;
          } else {
            prompt += `Assistant: ${msg.content}\n`;
          }
        });
        
        const result = await geminiModel.generateContent(prompt);
        const googleResponse = result.response;
        
        response = {
          id: 'gemini-' + Date.now(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: googleResponse.text()
            },
            finish_reason: 'stop'
          }],
          usage: { 
            prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
            completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: result.response.usageMetadata?.totalTokenCount || 0
          }
        };
      } catch (error) {
        console.error('Google API error:', error);
        
        // Handle specific Google API error types
        if (error.message && error.message.includes('429 Too Many Requests')) {
          return res.status(429).json({ 
            error: 'Google Gemini API quota exceeded. Free tier limits reached.',
            details: 'Daily/minute request limits or token limits exceeded. Try again later or upgrade your Google API plan.',
            provider: 'Google'
          });
        } else if (error.message && error.message.includes('403 Forbidden')) {
          return res.status(403).json({ 
            error: 'Google Gemini API access forbidden. Check your API key.',
            details: error.message || 'API key may be invalid or restricted',
            provider: 'Google'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to generate response from Google',
            details: error.message || 'Unknown error',
            provider: 'Google'
          });
        }
      }
    } else if ((model.includes('llama') || model.includes('gemma')) && groq) {
      // Real Groq API call
      try {
        const groqResponse = await groq.chat.completions.create({
          messages: messages,
          model: model,
          temperature: temperature,
          max_tokens: max_tokens,
        });
        
        response = groqResponse;
      } catch (error) {
        console.error('Groq API error:', error);
        return res.status(500).json({ 
          error: 'Failed to generate response from Groq',
          details: error.message || 'Unknown error'
        });
      }
    } else if (model.includes('grok') && xai) {
      // Real xAI API call (OpenAI-compatible)
      try {
        const xaiResponse = await xai.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
        });
        
        response = xaiResponse;
      } catch (error) {
        console.error('xAI API error:', error);
        
        // Handle specific xAI API error types
        if (error.status === 404) {
          return res.status(404).json({ 
            error: 'xAI model not available. Model may not exist or you may not have access.',
            details: `The model "${model}" is not available. Try using grok-2-1212 or grok-2-vision-1212 instead.`,
            provider: 'xAI'
          });
        } else if (error.status === 401) {
          return res.status(401).json({ 
            error: 'xAI API key is invalid or expired.',
            details: error.message || 'Check your xAI API key configuration',
            provider: 'xAI'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to generate response from xAI',
            details: error.message || 'Unknown error',
            provider: 'xAI'
          });
        }
      }
    } else if (model.includes('deepseek') && deepseek) {
      // Real Deepseek API call (OpenAI-compatible)
      try {
        const deepseekResponse = await deepseek.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: max_tokens,
        });
        
        response = deepseekResponse;
      } catch (error) {
        console.error('Deepseek API error:', error);
        return res.status(500).json({ 
          error: 'Failed to generate response from Deepseek',
          details: error.message || 'Unknown error'
        });
      }
    } else {
      console.log('❌ NO PROVIDER MATCHED:');
      console.log('   - provider:', provider);
      console.log('   - model:', model);
      console.log('   - isOpenRouterModel:', isOpenRouterModel);
      console.log('   - openrouter exists:', !!openrouter);
      console.log('   - model.includes("gpt"):', model.includes('gpt'));
      console.log('   - model.includes("claude"):', model.includes('claude'));
      console.log('   - model.includes("gemini"):', model.includes('gemini'));
      console.log('   - model.includes("llama") || model.includes("gemma"):', model.includes('llama') || model.includes('gemma'));
      console.log('   - model.includes("grok"):', model.includes('grok'));
      console.log('   - model.includes("deepseek"):', model.includes('deepseek'));
      return res.status(400).json({ error: 'Model not supported or API key not configured' });
    }
    
    // Debug logging for response structure
    console.log('🔍 Chat completion response structure:', {
      hasUsage: !!response.usage,
      responseKeys: Object.keys(response || {}),
      usageData: response.usage || 'No usage data'
    });
    
    // Track token usage - compatible with production database schema
    if (response.usage) {
      const totalTokens = response.usage.total_tokens || (response.usage.prompt_tokens + response.usage.completion_tokens) || 0;
      const cost = totalTokens * 0.00001; // Estimate cost
      
      console.log('💰 About to track usage:', {
        userId: req.user.userId,
        totalTokens,
        cost,
        model,
        rawUsage: response.usage
      });
      
      try {
        // First, check what columns exist in the production database
        const tableInfo = db.prepare("PRAGMA table_info(token_usage)").all();
        const columnNames = tableInfo.map(col => col.name);
        console.log('📊 Production table columns:', columnNames);
        
        // Use the correct schema based on what columns exist
        if (columnNames.includes('tokens') && columnNames.includes('cost') && columnNames.includes('model')) {
          // New schema - local development
          db.prepare(
            'INSERT INTO token_usage (user_id, tokens, cost, model) VALUES (?, ?, ?, ?)'
          ).run(req.user.userId, totalTokens, cost, model);
        } else if (columnNames.includes('total_tokens') && columnNames.includes('model_name')) {
          // Production schema - Railway database
          db.prepare(
            'INSERT INTO token_usage (user_id, model_id, model_name, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
            req.user.userId,
            model,
            model,
            response.usage.prompt_tokens || 0,
            response.usage.completion_tokens || 0,
            totalTokens
          );
        } else {
          console.error('❌ Unknown database schema. Available columns:', columnNames);
        }
        
        console.log(`✅ Usage tracked: ${totalTokens} tokens for ${model} (user ${req.user.userId})`);
      } catch (error) {
        console.error('❌ Failed to track usage in chat/completions:', error);
        console.error('Error details:', error.message);
      }
    } else {
      console.warn('⚠️ No usage data in AI response - tracking skipped');
    }
    
    res.json(response);
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Usage stats endpoint - Comprehensive analytics
app.get('/api/usage/stats', authenticateToken, (req, res) => {
  try {
    // Check database schema first
    const tableInfo = db.prepare("PRAGMA table_info(token_usage)").all();
    const columnNames = tableInfo.map(col => col.name);
    console.log('📊 Usage stats - table columns:', columnNames);
    
    let overallStats, modelUsage, dailyUsage;
    
    if (columnNames.includes('tokens') && columnNames.includes('cost') && columnNames.includes('model')) {
      // New schema - local development
      overallStats = db.prepare(`
        SELECT 
          COALESCE(SUM(tokens), 0) as totalTokens,
          COALESCE(SUM(cost), 0) as totalCost,
          COUNT(*) as totalUsageRecords
        FROM token_usage 
        WHERE user_id = ?
      `).get(req.user.userId);
      
      modelUsage = db.prepare(`
        SELECT 
          COALESCE(model, 'Unknown') as model,
          COALESCE(SUM(tokens), 0) as tokens,
          COUNT(*) as conversations,
          COALESCE(SUM(cost), 0) as cost
        FROM token_usage 
        WHERE user_id = ?
        GROUP BY model
        ORDER BY tokens DESC
        LIMIT 10
      `).all(req.user.userId);
      
      dailyUsage = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(tokens), 0) as tokens,
          COALESCE(SUM(cost), 0) as cost
        FROM token_usage 
        WHERE user_id = ? AND created_at >= date('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all(req.user.userId);
      
    } else if (columnNames.includes('total_tokens') && columnNames.includes('model_name')) {
      // Production schema - Railway database
      overallStats = db.prepare(`
        SELECT 
          COALESCE(SUM(total_tokens), 0) as totalTokens,
          COALESCE(SUM(total_tokens), 0) * 0.00001 as totalCost,
          COUNT(*) as totalUsageRecords
        FROM token_usage 
        WHERE user_id = ?
      `).get(req.user.userId);
      
      modelUsage = db.prepare(`
        SELECT 
          COALESCE(model_name, 'Unknown') as model,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COUNT(*) as conversations,
          COALESCE(SUM(total_tokens), 0) * 0.00001 as cost
        FROM token_usage 
        WHERE user_id = ?
        GROUP BY model_name
        ORDER BY tokens DESC
        LIMIT 10
      `).all(req.user.userId);
      
      dailyUsage = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(total_tokens), 0) * 0.00001 as cost
        FROM token_usage 
        WHERE user_id = ? AND created_at >= date('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all(req.user.userId);
    } else {
      console.error('❌ Unknown database schema in usage stats. Available columns:', columnNames);
      return res.status(500).json({ error: 'Database schema not recognized' });
    }
    
    // Total conversations (from conversations table)
    const conversationStats = db.prepare(`
      SELECT COUNT(*) as totalConversations
      FROM conversations 
      WHERE user_id = ?
    `).get(req.user.userId);
    
    // Get subscription information
    const subscriptionInfo = db.prepare(`
      SELECT s.plan_type, s.current_period_start, s.current_period_end,
             up.tokens_used, up.tokens_limit, up.period_start, up.period_end
      FROM subscriptions s
      LEFT JOIN subscription_usage_periods up ON s.id = up.subscription_id AND up.status = 'active'
      WHERE s.user_id = ? AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `).get(req.user.userId);
    
    console.log('📈 Usage stats computed:', {
      totalTokens: overallStats.totalTokens,
      totalConversations: conversationStats.totalConversations,
      modelCount: modelUsage.length,
      dailyRecords: dailyUsage.length,
      subscription: subscriptionInfo ? subscriptionInfo.plan_type : 'none'
    });
    
    res.json({
      totalTokens: overallStats.totalTokens || 0,
      inputTokens: Math.round((overallStats.totalTokens || 0) * 0.4), // Estimate 40% input
      outputTokens: Math.round((overallStats.totalTokens || 0) * 0.6), // Estimate 60% output
      totalConversations: conversationStats.totalConversations || 0,
      totalCost: overallStats.totalCost || 0,
      modelUsage: modelUsage.map(model => ({
        model: model.model || 'Unknown',
        tokens: model.tokens || 0,
        conversations: model.conversations || 0,
        cost: model.cost || 0
      })),
      dailyUsage: dailyUsage.map(day => ({
        date: day.date,
        tokens: day.tokens || 0,
        cost: day.cost || 0
      })),
      subscription: subscriptionInfo ? {
        plan_type: subscriptionInfo.plan_type,
        current_period_start: subscriptionInfo.current_period_start,
        current_period_end: subscriptionInfo.current_period_end,
        period_tokens_used: subscriptionInfo.tokens_used || 0,
        period_tokens_limit: subscriptionInfo.tokens_limit || 50000,
        period_start: subscriptionInfo.period_start,
        period_end: subscriptionInfo.period_end
      } : null
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Track usage endpoint  
app.post('/api/usage/track', authenticateToken, (req, res) => {
  try {
    const { model_id, model_name, prompt_tokens, completion_tokens, total_tokens, tokens, cost, model } = req.body;
    
    // Calculate values based on input format
    const finalTokens = tokens || total_tokens || (prompt_tokens + completion_tokens) || 0;
    const finalCost = cost || (finalTokens * 0.00001); // Estimate cost if not provided
    const finalModel = model || model_name || 'Unknown';
    
    console.log('🎯 Frontend tracking request:', {
      userId: req.user.userId,
      finalTokens,
      finalCost,
      finalModel,
      originalData: req.body
    });
    
    // Check database schema and insert accordingly
    const tableInfo = db.prepare("PRAGMA table_info(token_usage)").all();
    const columnNames = tableInfo.map(col => col.name);
    console.log('📊 Track endpoint - table columns:', columnNames);
    
    if (columnNames.includes('tokens') && columnNames.includes('cost') && columnNames.includes('model')) {
      // New schema - local development
      db.prepare(
        'INSERT INTO token_usage (user_id, tokens, cost, model) VALUES (?, ?, ?, ?)'
      ).run(req.user.userId, finalTokens, finalCost, finalModel);
    } else if (columnNames.includes('total_tokens') && columnNames.includes('model_name')) {
      // Production schema - Railway database
      db.prepare(
        'INSERT INTO token_usage (user_id, model_id, model_name, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        req.user.userId,
        model_id || finalModel,
        finalModel,
        prompt_tokens || Math.floor(finalTokens * 0.4) || 0,
        completion_tokens || Math.floor(finalTokens * 0.6) || 0,
        finalTokens
      );
    } else {
      console.error('❌ Unknown database schema in track endpoint. Available columns:', columnNames);
      return res.status(500).json({ error: 'Database schema not recognized' });
    }
    
    // Update subscription usage period
    try {
      db.prepare(`
        UPDATE subscription_usage_periods 
        SET tokens_used = tokens_used + ?
        WHERE user_id = ? AND status = 'active'
      `).run(finalTokens, req.user.userId);
      
      console.log(`🔄 Updated subscription usage: +${finalTokens} tokens for user ${req.user.userId}`);
    } catch (subError) {
      console.warn('⚠️ Failed to update subscription usage (continuing):', subError.message);
    }
    
    console.log(`✅ Frontend tracking successful: ${finalTokens} tokens for ${finalModel} (user ${req.user.userId})`);
    res.json({ success: true, message: 'Usage tracked successfully' });
  } catch (error) {
    console.error('Error tracking usage:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Model providers endpoint
app.get('/api/models/providers', async (req, res) => {
  try {
    let providers = [];

    // Add OpenRouter first if key is available
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          // 🔥 FLAGSHIP PREMIUM MODELS (LATEST & GREATEST) 🔥
          
          // GPT-5 MODELS (NEWEST OPENAI)
          { id: 'openai/gpt-5-chat', name: '🚀 GPT-5 Chat (Latest)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'openai/gpt-5-mini', name: '⚡ GPT-5 Mini (Fast)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'openai/gpt-5-nano', name: '💨 GPT-5 Nano (Ultra Fast)', provider: 'openrouter', requiresKey: true, context: 200000 },
          
          // CLAUDE OPUS & SONNET 4 (NEWEST ANTHROPIC)
          { id: 'anthropic/claude-opus-4.1', name: '🧠 Claude Opus 4.1 (Ultimate)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'anthropic/claude-opus-4', name: '🎯 Claude Opus 4 (Powerful)', provider: 'openrouter', requiresKey: true, context: 200000 },
          { id: 'anthropic/claude-sonnet-4', name: '⚡ Claude Sonnet 4 (Balanced)', provider: 'openrouter', requiresKey: true, context: 200000 },
          
          // GEMINI 2.5 MODELS (NEWEST GOOGLE)
          { id: 'google/gemini-2.5-pro', name: '💎 Gemini 2.5 Pro (Ultimate)', provider: 'openrouter', requiresKey: true, context: 2000000 },
          { id: 'google/gemini-2.5-flash', name: '⚡ Gemini 2.5 Flash (Lightning)', provider: 'openrouter', requiresKey: true, context: 1000000 },
          { id: 'google/gemini-2.5-pro-exp-03-25', name: '🧪 Gemini 2.5 Pro Experimental', provider: 'openrouter', requiresKey: true, context: 2000000 },
          
          // GROK 3 & 4 MODELS (NEWEST XAI)
          { id: 'x-ai/grok-4', name: '🔥 Grok 4 (Latest)', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'x-ai/grok-3', name: '🚀 Grok 3 (Advanced)', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'x-ai/grok-3-mini', name: '⚡ Grok 3 Mini (Fast)', provider: 'openrouter', requiresKey: true, context: 131072 },
          
          // EXISTING PREMIUM MODELS
          { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'mistralai/codestral-2508', name: 'Codestral 2508 (Code)', provider: 'openrouter', requiresKey: true, context: 32768 },
          { id: 'mistralai/pixtral-large-2411', name: 'Pixtral Large (Vision)', provider: 'openrouter', requiresKey: true, context: 128000 },
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'cohere/command-r-plus-08-2024', name: 'Cohere Command R+', provider: 'openrouter', requiresKey: true, context: 128000 },
          { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (Largest)', provider: 'openrouter', requiresKey: true, context: 131072 }
        ]
      });
    }

    // Add other providers
    providers = providers.concat([
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o (Latest)', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'o1-pro', name: 'OpenAI o1 Pro (Reasoning)', provider: 'openai', requiresKey: true, context: 200000 },
          { id: 'o1', name: 'OpenAI o1 (Reasoning)', provider: 'openai', requiresKey: true, context: 200000 },
          { id: 'o1-mini', name: 'OpenAI o1 Mini (Reasoning)', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', requiresKey: true, context: 128000 },
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', requiresKey: true, context: 8192 },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', requiresKey: true, context: 16385 }
        ]
      },
      {
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        models: [
          { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1 (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Latest)', provider: 'anthropic', requiresKey: true, context: 200000 },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', requiresKey: true, context: 200000 }
        ]
      },
      {
        id: 'groq',
        name: 'Groq',
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Latest)', provider: 'groq', requiresKey: true, context: 131072 },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', requiresKey: true, context: 131072 }
        ]
      },
      {
        id: 'google',
        name: 'Google (Gemini)',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', requiresKey: true, context: 2000000 },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', requiresKey: true, context: 1000000 },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', provider: 'google', requiresKey: true, context: 1000000 }
        ]
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        models: [
          { id: 'grok-2-1212', name: 'Grok 2 (Latest)', provider: 'xai', requiresKey: true, context: 131072 },
          { id: 'grok-2-vision-1212', name: 'Grok 2 Vision (Latest)', provider: 'xai', requiresKey: true, context: 131072 }
        ]
      },
      {
        id: 'deepseek',
        name: 'Deepseek',
        models: [
          { id: 'deepseek-chat', name: 'Deepseek Chat (Latest)', provider: 'deepseek', requiresKey: true, context: 32768 },
          { id: 'deepseek-coder', name: 'Deepseek Coder', provider: 'deepseek', requiresKey: true, context: 16384 }
        ]
      }
    ]);


    // Check which API keys are available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasXAI = !!process.env.XAI_API_KEY;
    const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    // Filter providers based on available keys
    const availableProviders = providers.filter(provider => {
      if (provider.name === 'OpenAI') return hasOpenAI;
      if (provider.name === 'Anthropic (Claude)') return hasAnthropic;
      if (provider.name === 'Google (Gemini)') return hasGoogle;
      if (provider.name === 'Groq') return hasGroq;
      if (provider.name === 'xAI (Grok)') return hasXAI;
      if (provider.name === 'Deepseek') return hasDeepseek;
      if (provider.id === 'openrouter') return hasOpenRouter;
      return false;
    });

    res.json({ 
      success: true, 
      providers: availableProviders 
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// ========== SUBSCRIPTION MANAGEMENT ENDPOINTS ==========

// Get user's current subscription
app.get('/api/subscription', authenticateToken, (req, res) => {
  try {
    const subscription = db.prepare(`
      SELECT s.*, up.tokens_used, up.tokens_limit, up.period_start, up.period_end
      FROM subscriptions s
      LEFT JOIN subscription_usage_periods up ON s.id = up.subscription_id AND up.status = 'active'
      WHERE s.user_id = ? AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `).get(req.user.userId);

    if (!subscription) {
      // Create default subscription if none exists
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      const newSub = db.prepare(`
        INSERT INTO subscriptions (user_id, plan_type, status, current_period_start, current_period_end)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.userId, 'explore', 'active', now.toISOString(), monthEnd.toISOString());
      
      db.prepare(`
        INSERT INTO subscription_usage_periods (
          user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.userId, newSub.lastInsertRowid, now.toISOString(), monthEnd.toISOString(), 0, 50000, 'explore');
      
      return res.json({
        id: newSub.lastInsertRowid,
        plan_type: 'explore',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: monthEnd.toISOString(),
        tokens_used: 0,
        tokens_limit: 50000,
        period_start: now.toISOString(),
        period_end: monthEnd.toISOString()
      });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Upgrade subscription
app.post('/api/subscription/upgrade', authenticateToken, async (req, res) => {
  try {
    const { planType } = req.body;
    
    const planLimits = {
      explore: { tokens: 50000, price: 0 },
      starter: { tokens: 250000, price: 19 },
      professional: { tokens: 750000, price: 49 },
      enterprise: { tokens: 3000000, price: 199 }
    };

    if (!planLimits[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Start transaction
    const updateSub = db.transaction(() => {
      // End current subscription
      db.prepare(`
        UPDATE subscriptions 
        SET status = 'cancelled', updated_at = ?
        WHERE user_id = ? AND status = 'active'
      `).run(now.toISOString(), req.user.userId);

      // End current usage period
      db.prepare(`
        UPDATE subscription_usage_periods 
        SET status = 'ended'
        WHERE user_id = ? AND status = 'active'
      `).run(req.user.userId);

      // Create new subscription
      const newSub = db.prepare(`
        INSERT INTO subscriptions (
          user_id, plan_type, status, current_period_start, current_period_end
        ) VALUES (?, ?, ?, ?, ?)
      `).run(req.user.userId, planType, 'active', now.toISOString(), monthEnd.toISOString());

      // Create new usage period
      db.prepare(`
        INSERT INTO subscription_usage_periods (
          user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.userId, newSub.lastInsertRowid, now.toISOString(), monthEnd.toISOString(), 0, planLimits[planType].tokens, planType);

      // Update user's subscription tier
      db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?').run(planType, req.user.userId);

      return newSub.lastInsertRowid;
    });

    const subscriptionId = updateSub();

    res.json({
      success: true,
      subscription: {
        id: subscriptionId,
        plan_type: planType,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: monthEnd.toISOString(),
        tokens_used: 0,
        tokens_limit: planLimits[planType].tokens
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

// Renew subscription (for monthly renewals)
app.post('/api/subscription/renew', authenticateToken, async (req, res) => {
  try {
    const subscription = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(req.user.userId);

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const planLimits = {
      explore: { tokens: 50000, price: 0 },
      starter: { tokens: 250000, price: 19 },
      professional: { tokens: 750000, price: 49 },
      enterprise: { tokens: 3000000, price: 199 }
    };

    const now = new Date();
    const newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    const renewTxn = db.transaction(() => {
      // Update subscription period
      db.prepare(`
        UPDATE subscriptions 
        SET current_period_start = ?, current_period_end = ?, updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), newPeriodEnd.toISOString(), now.toISOString(), subscription.id);

      // End current usage period
      db.prepare(`
        UPDATE subscription_usage_periods 
        SET status = 'ended'
        WHERE subscription_id = ? AND status = 'active'
      `).run(subscription.id);

      // Create new usage period
      db.prepare(`
        INSERT INTO subscription_usage_periods (
          user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.userId, subscription.id, now.toISOString(), newPeriodEnd.toISOString(), 0, planLimits[subscription.plan_type].tokens, subscription.plan_type);

      // Record renewal
      db.prepare(`
        INSERT INTO subscription_renewals (
          user_id, subscription_id, old_period_end, new_period_start, new_period_end, 
          plan_type, renewal_type, amount_paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.userId, subscription.id, subscription.current_period_end, now.toISOString(), newPeriodEnd.toISOString(), subscription.plan_type, 'automatic', planLimits[subscription.plan_type].price);
    });

    renewTxn();

    res.json({
      success: true,
      message: 'Subscription renewed successfully',
      new_period_end: newPeriodEnd.toISOString()
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

// Get subscription history
app.get('/api/subscription/history', authenticateToken, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT 
        s.plan_type,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.created_at,
        r.renewal_type,
        r.amount_paid,
        r.created_at as renewal_date
      FROM subscriptions s
      LEFT JOIN subscription_renewals r ON s.id = r.subscription_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.userId);

    res.json({ history });
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

// Check if subscription needs renewal (for automated checks)
app.get('/api/subscription/check-renewal', authenticateToken, (req, res) => {
  try {
    const subscription = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(req.user.userId);

    if (!subscription) {
      return res.json({ needsRenewal: false });
    }

    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();
    const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    res.json({
      needsRenewal: daysLeft <= 3,
      daysLeft,
      subscription: {
        plan_type: subscription.plan_type,
        current_period_end: subscription.current_period_end
      }
    });
  } catch (error) {
    console.error('Error checking renewal:', error);
    res.status(500).json({ error: 'Failed to check renewal status' });
  }
});

// ========== STRIPE PAYMENT ENDPOINTS ==========

// Create Stripe customer for user
app.post('/api/stripe/create-customer', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const { email, name } = req.body;
    
    // Check if user already has a Stripe customer
    const existingSubscription = db.prepare('SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? AND stripe_customer_id IS NOT NULL LIMIT 1').get(req.user.userId);
    
    if (existingSubscription?.stripe_customer_id) {
      return res.json({ customer_id: existingSubscription.stripe_customer_id });
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      metadata: {
        user_id: req.user.userId.toString()
      }
    });

    res.json({ customer_id: customer.id });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Create payment intent for plan upgrade
app.post('/api/stripe/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const { planType, customerId } = req.body;
    
    const planPrices = {
      starter: 1900,    // $19.00 in cents
      professional: 4900, // $49.00 in cents
      enterprise: 19900   // $199.00 in cents
    };

    if (!planPrices[planType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: planPrices[planType],
      currency: 'usd',
      customer: customerId,
      metadata: {
        user_id: req.user.userId.toString(),
        plan_type: planType,
        subscription_type: 'upgrade'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      amount: planPrices[planType]
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Create Stripe subscription
app.post('/api/stripe/create-subscription', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const { planType, customerId, paymentMethodId } = req.body;
    
    const planPriceIds = {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
    };

    if (!planPriceIds[planType]) {
      return res.status(400).json({ error: 'Invalid plan type or price ID not configured' });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      default_source: paymentMethodId,
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planPriceIds[planType] }],
      default_payment_method: paymentMethodId,
      metadata: {
        user_id: req.user.userId.toString(),
        plan_type: planType
      }
    });

    // Update local subscription record
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end * 1000);

    const updateTxn = db.transaction(() => {
      // End current subscription
      db.prepare(`
        UPDATE subscriptions 
        SET status = 'cancelled', updated_at = ?
        WHERE user_id = ? AND status = 'active'
      `).run(now.toISOString(), req.user.userId);

      // Create new subscription with Stripe data
      const newSub = db.prepare(`
        INSERT INTO subscriptions (
          user_id, plan_type, status, current_period_start, current_period_end,
          stripe_subscription_id, stripe_customer_id, stripe_price_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.userId,
        planType,
        'active',
        new Date(subscription.current_period_start * 1000).toISOString(),
        periodEnd.toISOString(),
        subscription.id,
        customerId,
        planPriceIds[planType]
      );

      // Update user plan
      db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?').run(planType, req.user.userId);

      return newSub.lastInsertRowid;
    });

    const subscriptionId = updateTxn();

    res.json({
      subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      local_subscription_id: subscriptionId
    });
  } catch (error) {
    console.error('Error creating Stripe subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel Stripe subscription
app.post('/api/stripe/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const subscription = db.prepare(`
      SELECT stripe_subscription_id FROM subscriptions 
      WHERE user_id = ? AND status = 'active' AND stripe_subscription_id IS NOT NULL
      LIMIT 1
    `).get(req.user.userId);

    if (!subscription?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No active Stripe subscription found' });
    }

    // Cancel at period end
    const cancelledSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    // Update local record
    db.prepare(`
      UPDATE subscriptions 
      SET cancel_at_period_end = 1, updated_at = ?
      WHERE stripe_subscription_id = ?
    `).run(new Date().toISOString(), subscription.stripe_subscription_id);

    res.json({
      success: true,
      cancel_at_period_end: true,
      current_period_end: cancelledSubscription.current_period_end
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get Stripe billing portal session
app.post('/api/stripe/billing-portal', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const subscription = db.prepare(`
      SELECT stripe_customer_id FROM subscriptions 
      WHERE user_id = ? AND stripe_customer_id IS NOT NULL
      LIMIT 1
    `).get(req.user.userId);

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: process.env.CLIENT_URL || 'http://localhost:5173/billing',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// ========== STRIPE WEBHOOKS ==========

// Stripe webhook endpoint (before body parsing middleware)
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log('📧 Stripe webhook received:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
        
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Helper functions for webhook handling
async function handleCheckoutCompleted(session) {
  try {
    console.log('🎉 Checkout session completed:', session.id);
    console.log('Session data:', JSON.stringify({
      client_reference_id: session.client_reference_id,
      customer_email: session.customer_email,
      metadata: session.metadata,
      line_items: session.line_items?.data?.[0]?.description
    }, null, 2));
    
    // For payment links, the user ID comes from client_reference_id
    const userId = session.client_reference_id || session.metadata?.userId;
    
    // Detect plan type from the line items or amount
    let planType = session.metadata?.planType;
    
    if (!planType) {
      // Try to detect from the amount paid
      const amountTotal = session.amount_total;
      if (amountTotal === 1000) { // $10 Starter
        planType = 'starter';
      } else if (amountTotal === 1900) { // Legacy $19 Starter
        planType = 'starter';
      } else if (amountTotal === 4900) { // Legacy $49 Professional (now Starter)
        planType = 'starter';
      } else if (amountTotal === 50000) { // $500 Enterprise one-time
        planType = 'enterprise';
      } else {
        // Try to get from line items description
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const description = lineItems.data[0]?.description?.toLowerCase() || '';
        
        if (description.includes('starter')) {
          planType = 'starter';
        } else if (description.includes('professional')) {
          planType = 'professional';
        } else if (description.includes('enterprise')) {
          planType = 'enterprise';
        }
      }
    }
    
    if (!userId || !planType) {
      console.error('Missing userId or planType:', { userId, planType, session: session.id });
      return;
    }

    // Define plan limits
    const planLimits = {
      starter: 750000,
      professional: 750000, // Legacy - same as starter
      enterprise: 999999999 // Unlimited with own keys
    };

    const tokenLimit = planLimits[planType];
    if (!tokenLimit) {
      console.error('Invalid plan type:', planType);
      return;
    }

    // Calculate new billing period
    const now = new Date();
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Update user's subscription_tier in the users table (FIXED: using correct table)
    console.log(`📝 Updating user ${userId} subscription_tier to ${planType}`);
    
    const updateUser = db.prepare(`
      UPDATE users 
      SET subscription_tier = ?
      WHERE id = ?
    `);
    
    const userResult = updateUser.run(planType, userId);
    
    if (userResult.changes === 0) {
      console.error(`❌ Failed to update user ${userId} - user not found in users table`);
      return;
    }
    
    console.log(`✅ Updated user ${userId} subscription_tier to ${planType} in users table`);
    
    // Get user details for email
    const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
    if (user) {
      // Send email notifications
      const amountPaid = session.amount_total || 0;
      
      // Send admin notification
      await sendAdminNotification(user.email, planType, amountPaid);
      
      // Send welcome email to customer
      await sendWelcomeEmail(user.email, user.name, planType);
    }

    // Also update or create subscription record in subscriptions table
    const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ? AND status = ?').get(userId, 'active');
    
    if (existingSub) {
      // Update existing subscription
      console.log(`📝 Updating existing subscription for user ${userId}`);
      db.prepare(`
        UPDATE subscriptions 
        SET plan_type = ?, 
            stripe_subscription_id = ?,
            current_period_start = ?,
            current_period_end = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND status = 'active'
      `).run(
        planType,
        session.subscription || 'checkout_' + session.id,
        now.toISOString(),
        nextBillingDate.toISOString(),
        userId
      );
      console.log(`✅ Updated subscription record for user ${userId}`);
    } else {
      // Create new subscription
      console.log(`📝 Creating new subscription for user ${userId}`);
      db.prepare(`
        INSERT INTO subscriptions (
          user_id, 
          stripe_subscription_id,
          stripe_customer_id,
          plan_type,
          status,
          current_period_start,
          current_period_end,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        userId,
        session.subscription || 'checkout_' + session.id,
        session.customer,
        planType,
        now.toISOString(),
        nextBillingDate.toISOString()
      );
      console.log(`✅ Created subscription record for user ${userId}`);
    }

    console.log(`🎉 Successfully upgraded user ${userId} to ${planType} plan`);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

async function handleSubscriptionUpdate(subscription) {
  try {
    const userId = subscription.metadata.user_id;
    if (!userId) {
      console.error('No user_id in subscription metadata');
      return;
    }

    const now = new Date();
    const periodStart = new Date(subscription.current_period_start * 1000);
    const periodEnd = new Date(subscription.current_period_end * 1000);

    // Determine plan type from price ID
    const priceId = subscription.items.data[0]?.price?.id;
    let planType = 'explore';
    
    if (priceId === process.env.STRIPE_STARTER_PRICE_ID) planType = 'starter';
    else if (priceId === process.env.STRIPE_PROFESSIONAL_PRICE_ID) planType = 'professional';
    else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) planType = 'enterprise';

    const planLimits = {
      explore: { tokens: 50000, price: 0 },
      starter: { tokens: 250000, price: 19 },
      professional: { tokens: 750000, price: 49 },
      enterprise: { tokens: 3000000, price: 199 }
    };

    // Update subscription in database
    const updateTxn = db.transaction(() => {
      // Update or create subscription
      const existingSub = db.prepare('SELECT id FROM subscriptions WHERE stripe_subscription_id = ?').get(subscription.id);
      
      if (existingSub) {
        // Update existing
        db.prepare(`
          UPDATE subscriptions 
          SET plan_type = ?, status = ?, current_period_start = ?, current_period_end = ?, 
              cancel_at_period_end = ?, updated_at = ?
          WHERE stripe_subscription_id = ?
        `).run(
          planType,
          subscription.status === 'active' ? 'active' : 'cancelled',
          periodStart.toISOString(),
          periodEnd.toISOString(),
          subscription.cancel_at_period_end ? 1 : 0,
          now.toISOString(),
          subscription.id
        );

        // End old usage periods
        db.prepare('UPDATE subscription_usage_periods SET status = "ended" WHERE subscription_id = ? AND status = "active"').run(existingSub.id);

        // Create new usage period
        db.prepare(`
          INSERT INTO subscription_usage_periods (
            user_id, subscription_id, period_start, period_end, tokens_used, tokens_limit, plan_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, existingSub.id, periodStart.toISOString(), periodEnd.toISOString(), 0, planLimits[planType].tokens, planType);
      }

      // Update user plan
      db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?').run(planType, userId);
    });

    updateTxn();
    console.log(`✅ Updated subscription for user ${userId} to ${planType} plan`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCancellation(subscription) {
  try {
    // Mark subscription as cancelled
    db.prepare(`
      UPDATE subscriptions 
      SET status = 'cancelled', updated_at = ?
      WHERE stripe_subscription_id = ?
    `).run(new Date().toISOString(), subscription.id);

    console.log(`✅ Cancelled subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handlePaymentSuccess(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    const customerId = invoice.customer;
    
    // Record successful payment
    console.log(`✅ Payment succeeded for subscription ${subscriptionId}`);
    
    // Could record payment history here if needed
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Stripe endpoints
app.post('/api/stripe/create-customer', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { email, name } = req.body;
    
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });
    if (existingCustomers.data.length > 0) {
      return res.json({ customer_id: existingCustomers.data[0].id });
    }
    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      metadata: {
        userId: req.user.id,
      },
    });
    res.json({ customer_id: customer.id });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Coupon validation endpoint - uses actual Stripe promotion codes (no auth required)
app.post('/api/stripe/validate-coupon', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  try {
    const { code } = req.body;
    
    // Try to retrieve the promotion code from Stripe
    try {
      const promotionCodes = await stripe.promotionCodes.list({
        code: code.toUpperCase(),
        limit: 1
      });
      
      if (promotionCodes.data.length > 0) {
        const promoCode = promotionCodes.data[0];
        
        // Check if the promotion code is active
        if (promoCode.active) {
          const coupon = promoCode.coupon;
          
          // Get the discount percentage or amount
          const discount = coupon.percent_off || 0;
          const amountOff = coupon.amount_off ? coupon.amount_off / 100 : 0;
          
          res.json({ 
            valid: true, 
            discount: discount,
            amountOff: amountOff,
            promoCodeId: promoCode.id,
            couponId: coupon.id
          });
        } else {
          res.json({ valid: false, discount: 0 });
        }
      } else {
        res.json({ valid: false, discount: 0 });
      }
    } catch (stripeError) {
      console.error('Stripe coupon lookup error:', stripeError);
      res.json({ valid: false, discount: 0 });
    }
  } catch (error) {
    console.error('Coupon validation error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Verify checkout session after payment link redirect
app.get('/api/stripe/verify-session/:sessionId', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  try {
    const { sessionId } = req.params;
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Get user ID from client_reference_id
      const userId = session.client_reference_id;
      
      if (userId && userId !== 'guest') {
        // Determine plan type from amount
        let planType = 'explore';
        const amount = session.amount_total;
        
        if (amount === 1900) planType = 'starter';
        else if (amount === 4900) planType = 'professional';
        else if (amount === 19900) planType = 'enterprise';
        
        // Update user's subscription
        const result = db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?')
          .run(planType, userId);
        
        if (result.changes > 0) {
          console.log(`✅ Updated user ${userId} to ${planType} plan via payment link`);
        }
      }
      
      res.json({
        success: true,
        paid: true,
        customerEmail: session.customer_details?.email,
        amount: session.amount_total,
        userId: userId
      });
    } else {
      res.json({
        success: false,
        paid: false,
        status: session.payment_status
      });
    }
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

// Create Stripe Checkout Session (NO MORE CAPTCHA ISSUES!)
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  console.log('📨 Received checkout session request:', { 
    body: req.body,
    hasStripe: !!stripe 
  });
  
  if (!stripe) {
    console.error('❌ Stripe not configured - check STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  
  try {
    const { planType, userEmail, userName, userId, successUrl, cancelUrl } = req.body;
    
    console.log('🔍 Request validation:', {
      planType,
      userEmail,
      userName,
      userId,
      hasSuccessUrl: !!successUrl,
      hasCancelUrl: !!cancelUrl
    });
    
    if (!planType || !userEmail || !userId) {
      return res.status(400).json({ error: 'Missing required fields: planType, userEmail, userId' });
    }
    
    // Use actual Stripe Price IDs from your products
    const planPriceIds = {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID, 
      enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
    };
    
    console.log('💳 Price ID configuration:', {
      starterPriceId: process.env.STRIPE_STARTER_PRICE_ID ? 'SET' : 'MISSING',
      professionalPriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID ? 'SET' : 'MISSING',
      enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ? 'SET' : 'MISSING',
      requestedPlan: planType
    });
    
    const priceId = planPriceIds[planType];
    if (!priceId || priceId.includes('_id_here')) {
      console.error(`❌ Missing or placeholder Price ID for ${planType}: ${priceId}`);
      return res.status(400).json({ 
        error: `Stripe Price ID not configured for ${planType} plan. Please set STRIPE_${planType.toUpperCase()}_PRICE_ID in environment variables.` 
      });
    }
    
    console.log(`✅ Using Price ID for ${planType}: ${priceId}`);

    // Create or find customer
    let customerId;
    try {
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: userName || userEmail,
        });
        customerId = customer.id;
      }
    } catch (customerError) {
      console.error('Customer creation error:', customerError);
      return res.status(500).json({ error: 'Failed to create customer' });
    }
    
    const sessionData = {
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription', // Changed from 'payment' to 'subscription'
      line_items: [
        {
          price: priceId, // Use your actual Stripe Price ID
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.CLIENT_URL || 'https://anrak.tech'}/dashboard?payment=success`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL || 'https://anrak.tech'}/dashboard?payment=cancelled`,
      allow_promotion_codes: true, // Enable coupon codes in Stripe checkout
      metadata: {
        planType: planType,
        userId: userId
      },
      subscription_data: {
        metadata: {
          user_id: userId,  // For subscription webhooks
          planType: planType
        }
      }
    };
    
    console.log('🔄 Creating Stripe checkout session with data:', {
      customerId,
      priceId,
      planType,
      userId,
      successUrl: sessionData.success_url,
      cancelUrl: sessionData.cancel_url
    });
    
    const session = await stripe.checkout.sessions.create(sessionData);
    
    res.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('❌ Create checkout session error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      detail: error.detail,
      stack: error.stack
    });
    
    // Return more specific error message
    const errorMessage = error.message || 'Failed to create checkout session';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/stripe/billing-portal', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1,
    });
    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No Stripe customer found' });
    }
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/billing`,
    });
    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

async function handlePaymentFailure(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    // Handle failed payment - could send notifications, etc.
    console.log(`❌ Payment failed for subscription ${subscriptionId}`);
    
    // Could update subscription status or send user notifications
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Test email configuration on startup
testEmailConfiguration().then(result => {
  if (result) {
    console.log('📧 Email service ready - notifications will be sent');
  } else {
    console.log('⚠️ Email service not configured - notifications disabled');
  }
});

// Admin endpoint to manually update user subscription (temporary fix)
app.post('/api/admin/update-subscription', (req, res) => {
  const { email, tier, adminKey } = req.body;
  
  // Simple admin key check
  if (adminKey !== 'anrak-admin-2025') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = db.prepare('UPDATE users SET subscription_tier = ? WHERE email = ?').run(tier, email);
    
    if (result.changes > 0) {
      console.log(`✅ Admin update: ${email} -> ${tier} plan`);
      res.json({ 
        success: true, 
        message: `Updated ${email} to ${tier} plan`,
        user: { email, subscription_tier: tier }
      });
    } else {
      res.status(500).json({ error: 'Update failed' });
    }
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoint to get all users
app.get('/api/admin/users', (req, res) => {
  // Simplified admin check - just use the admin key for now
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== 'anrak-admin-2025') {
    return res.status(403).json({ error: 'Unauthorized - invalid admin key' });
  }
  
  try {
    const users = db.prepare(`
      SELECT 
        id, 
        email, 
        name, 
        subscription_tier, 
        created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    console.log(`Admin API: Returning ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin endpoint to update user plan
app.post('/api/admin/update-user-plan', (req, res) => {
  // Simplified admin check - just use the admin key for now
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== 'anrak-admin-2025') {
    return res.status(403).json({ error: 'Unauthorized - invalid admin key' });
  }
  
  const { userId, plan } = req.body;
  
  if (!userId || !plan) {
    return res.status(400).json({ error: 'Missing userId or plan' });
  }
  
  try {
    const result = db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?').run(plan, userId);
    
    if (result.changes > 0) {
      console.log(`✅ Admin updated user ${userId} to ${plan} plan`);
      
      // Get updated user info
      const updatedUser = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
      
      // Send notification email to admin
      if (updatedUser) {
        sendAdminNotification(
          updatedUser.email, 
          plan, 
          plan === 'starter' ? 1000 : plan === 'enterprise' ? 50000 : 0
        ).catch(err => console.error('Email notification failed:', err));
      }
      
      res.json({ 
        success: true, 
        message: `User updated to ${plan} plan`
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user plan:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Railway server running on http://localhost:${PORT}`);
  console.log('✅ OpenRouter integration deployed - 25 premium models including GPT-5, Gemini 2.5 Pro, Grok 4');
  console.log('✅ Email notifications enabled for new subscriptions');
});