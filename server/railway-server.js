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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

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

// Create indexes for better performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_user_id ON community_post_likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_post_id ON community_post_likes(post_id);
`);

// CORS configuration for production
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://bima-ai-decision-app-nzwf.vercel.app',
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

app.use(express.json());

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

// Simple text extraction function (basic implementation)
const extractText = async (buffer, filename) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (extension === 'txt') {
    return buffer.toString('utf-8');
  }
  
  // For PDF, DOCX, RTF - return filename as placeholder
  // In production, you'd use libraries like pdf-parse, mammoth, etc.
  return `Content from ${filename}\n\n[Document processing not fully implemented yet. This is a placeholder for the document content.]`;
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
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
    
    const token = jwt.sign({ userId: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '24h' });
    
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

// Models endpoints
app.get('/api/models', authenticateToken, (req, res) => {
  try {
    const models = db.prepare('SELECT * FROM models WHERE user_id = ? ORDER BY created_at DESC').all(req.user.userId);
    res.json(models);
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
    
    // Also get document count for this model
    const docCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE model_id = ?').get(id);
    model.document_count = docCount.count;
    
    // Normalize field names for frontend compatibility
    const responseModel = {
      ...model,
      system_instructions: model.system_prompt,
      opening_statement: model.greeting_message,
      documents: [] // Documents will be fetched separately by the documents endpoint
    };
    
    console.log('✅ Model found:', model.name, 'with', docCount.count, 'documents');
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
    
    const results = [];
    
    for (const file of files) {
      try {
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
    
    // Track token usage
    if (response.usage) {
      db.prepare(
        'INSERT INTO token_usage (user_id, model_id, model_name, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        req.user.userId,
        model,
        model,
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
        response.usage.total_tokens || 0
      );
    }
    
    res.json(response);
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Usage stats endpoint
app.get('/api/usage/stats', authenticateToken, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as totalConversations
      FROM token_usage 
      WHERE user_id = ?
    `).get(req.user.userId);
    
    res.json({
      totalTokens: stats.totalTokens || 0,
      totalConversations: stats.totalConversations || 0,
      dailyUsage: []
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Track usage endpoint  
app.post('/api/usage/track', authenticateToken, (req, res) => {
  try {
    const { model_id, model_name, prompt_tokens, completion_tokens, total_tokens } = req.body;
    
    // Insert usage tracking record
    db.prepare(
      'INSERT INTO token_usage (user_id, model_id, model_name, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req.user.userId,
      model_id,
      model_name,
      prompt_tokens || 0,
      completion_tokens || 0, 
      total_tokens || 0
    );
    
    res.json({ success: true, message: 'Usage tracked successfully' });
  } catch (error) {
    console.error('Error tracking usage:', error);
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

// Start server
app.listen(PORT, () => {
  console.log(`Railway server running on http://localhost:${PORT}`);
  console.log('✅ OpenRouter integration deployed - 25 premium models including GPT-5, Gemini 2.5 Pro, Grok 4');
});