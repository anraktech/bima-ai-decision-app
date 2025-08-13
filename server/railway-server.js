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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Database setup - use persistent volume in production
const dbDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
const dbPath = join(dbDir, 'database.db');

// Create directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('Using database at:', dbPath);
const db = new Database(dbPath);

// Create tables
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.post('/api/models', authenticateToken, (req, res) => {
  try {
    const { name, base_model, system_prompt, greeting_message } = req.body;
    
    if (!name || !base_model) {
      return res.status(400).json({ error: 'Name and base model are required' });
    }
    
    const result = db.prepare(
      'INSERT INTO models (user_id, name, base_model, system_prompt, greeting_message) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.userId, name, base_model, system_prompt || '', greeting_message || '');
    
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
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

// Chat completions endpoint - REAL API implementation
app.post('/api/chat/completions', authenticateToken, async (req, res) => {
  try {
    const { model, messages, temperature = 0.7, max_tokens = 1000 } = req.body;
    
    // Determine provider from model ID
    let response;
    
    if (model.includes('gpt') && openai) {
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
    } else if (model.includes('claude') && process.env.ANTHROPIC_API_KEY) {
      // Anthropic API call (you'd need to install @anthropic-ai/sdk)
      // For now, return a message that Anthropic is not yet implemented
      response = {
        id: 'claude-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Anthropic Claude integration is coming soon. Please use OpenAI models for now.'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      };
    } else if (model.includes('gemini') && process.env.GOOGLE_API_KEY) {
      // Google API call (you'd need to install @google/generative-ai)
      // For now, return a message that Google is not yet implemented
      response = {
        id: 'gemini-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Google Gemini integration is coming soon. Please use OpenAI models for now.'
          },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      };
    } else {
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

// Model providers endpoint
app.get('/api/models/providers', async (req, res) => {
  try {
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', requiresKey: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', requiresKey: true },
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', requiresKey: true },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', requiresKey: true }
        ]
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', requiresKey: true },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', requiresKey: true },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', requiresKey: true }
        ]
      },
      {
        id: 'google',
        name: 'Google',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', requiresKey: true },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', requiresKey: true }
        ]
      }
    ];

    // Check which API keys are available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;

    // Filter providers based on available keys
    const availableProviders = providers.filter(provider => {
      if (provider.name === 'OpenAI') return hasOpenAI;
      if (provider.name === 'Anthropic') return hasAnthropic;
      if (provider.name === 'Google') return hasGoogle;
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
});