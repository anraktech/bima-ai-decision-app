import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'crypto';
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
// PDF and RTF parsers will be dynamically imported when needed
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

// PostgreSQL Database setup
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('Database configuration:');
console.log('- Environment:', process.env.NODE_ENV || 'development');
console.log('- PostgreSQL URL:', process.env.DATABASE_PUBLIC_URL ? 'Found' : 'NOT FOUND');
console.log('- Server version: 2025-08-15-v3-openrouter-only');

// Test database connection
let dbConnected = false;

// Database migration function
async function applyDatabaseMigrations() {
  try {
    console.log('🔄 Applying database migrations...');
    
    // Migration 1: Handle models table schema updates
    try {
      // Check if we have custom_models table but not models table
      const tablesResult = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('models', 'custom_models')
      `);
      
      const tableNames = tablesResult.rows.map(row => row.table_name);
      
      if (tableNames.includes('custom_models') && !tableNames.includes('models')) {
        console.log('🔄 Migrating custom_models to models table...');
        await pool.query('ALTER TABLE custom_models RENAME TO models');
      }
      
      // Check and add missing columns to models table
      const columnsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'models' AND table_schema = 'public'
      `);
      
      const existingColumns = columnsResult.rows.map(row => row.column_name);
      
      // Add missing columns with appropriate defaults
      const requiredColumns = [
        { name: 'system_prompt', type: 'TEXT', default: null },
        { name: 'description', type: 'TEXT', default: null },
        { name: 'tags', type: 'TEXT[]', default: 'ARRAY[]::TEXT[]' },
        { name: 'is_imported', type: 'BOOLEAN', default: 'FALSE' },
        { name: 'original_model_id', type: 'INTEGER', default: null },
        { name: 'display_name', type: 'VARCHAR(255)', default: null },
        { name: 'share_token', type: 'VARCHAR(255)', default: null }
      ];
      
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name)) {
          console.log(`🔄 Adding column ${column.name} to models table...`);
          await pool.query(`
            ALTER TABLE models 
            ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}
          `);
        }
      }
      
    } catch (migrationError) {
      console.log('⚠️  Migration skipped (table may not exist yet):', migrationError.message);
    }
    
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't throw - allow server to continue
  }
}

async function initializeDatabase() {
  try {
    // Check if database URL is available
    if (!process.env.DATABASE_PUBLIC_URL && !process.env.DATABASE_URL) {
      console.log('⚠️  No database URL found, starting in limited mode');
      return true;
    }
    
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ PostgreSQL connection established');
    console.log('✅ Database test query successful:', testResult.rows[0]);
    
    // Apply database migrations first
    await applyDatabaseMigrations();
    
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        stripe_customer_id VARCHAR(255),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        base_model VARCHAR(255) NOT NULL,
        system_prompt TEXT,
        system_instructions TEXT,
        opening_statement TEXT,
        description TEXT,
        tags TEXT[],
        documents JSONB DEFAULT '[]',
        share_token VARCHAR(255) UNIQUE,
        is_public BOOLEAN DEFAULT FALSE,
        is_imported BOOLEAN DEFAULT FALSE,
        original_model_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500),
        model_a VARCHAR(255),
        model_b VARCHAR(255),
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        model_id VARCHAR(255) NOT NULL,
        model_name VARCHAR(255),
        model_tier VARCHAR(50) NOT NULL, -- ultra_premium, premium, standard, free
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost DECIMAL(10, 6) DEFAULT 0,
        conversation_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_tier ON usage_tracking(user_id, model_tier);
      CREATE INDEX IF NOT EXISTS idx_usage_tracking_tier ON usage_tracking(model_tier);
      CREATE INDEX IF NOT EXISTS idx_usage_tracking_created_at ON usage_tracking(created_at);
      CREATE INDEX IF NOT EXISTS idx_models_share_token ON models(share_token);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    console.log('✅ Database schema initialized successfully');
    dbConnected = true;
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('⚠️  Starting server without database connection');
    dbConnected = false;
    return true;
  }
}

// Configure Express middleware
app.use(cors({
  origin: [
    'http://localhost:5173',  // Local development
    'http://localhost:3000',  // Additional local port
    'https://anrak.tech',
    'https://www.anrak.tech',
    'https://bima-ai-decision-app-production.up.railway.app',
    /\.up\.railway\.app$/  // Railway domains only
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from dist directory
app.use(express.static(join(__dirname, '../dist')));
console.log('Static files path:', join(__dirname, '../dist'));

// Authentication middleware with backward compatibility
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Handle both 'id' and 'userId' fields for backward compatibility
    const userId = decoded.userId || decoded.id;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    
    if (!user) {
      console.error('User not found for token with userId:', userId);
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Debug endpoint
app.get('/debug/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbConnected,
    aiClients: {
      openai: !!openai,
      anthropic: !!anthropic,
      google: !!google,
      groq: !!groq,
      xai: !!xai,
      deepseek: !!deepseek,
      openrouter: !!openrouter
    },
    stripe: !!stripe
  });
});

// Test endpoint for model providers
app.get('/debug/models', (req, res) => {
  res.json({
    message: 'Models endpoint working',
    providers: ['openai', 'anthropic', 'google']
  });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, subscription_tier',
      [email, hashedPassword, name]
    );
    
    const user = result.rows[0];

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription_tier: user.subscription_tier
      }
    });

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(email, name).catch(console.error);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription_tier: user.subscription_tier,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Import usage enforcer  
const { enforceUsageLimits } = await import('./middleware/usageEnforcer.js');

// Chat completions endpoint with ROBUST usage enforcement
app.post('/api/chat/completions', authenticateToken, enforceUsageLimits(pool), async (req, res) => {
  try {
    const { provider, model, messages, temperature = 0.7, max_tokens = 2000 } = req.body;

    if (!provider || !model || !messages) {
      return res.status(400).json({ error: 'Provider, model, and messages are required' });
    }

    let response;
    let usage = null;

    switch (provider) {
      case 'openai':
        if (!openai) {
          return res.status(400).json({ error: 'OpenAI not configured' });
        }
        response = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        usage = response.usage;
        break;

      case 'anthropic':
        if (!anthropic) {
          return res.status(400).json({ error: 'Anthropic not configured' });
        }
        response = await anthropic.messages.create({
          model,
          max_tokens,
          temperature,
          messages: messages.filter(m => m.role !== 'system'),
          system: messages.find(m => m.role === 'system')?.content || undefined
        });
        usage = {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        };
        break;

      case 'google':
        if (!google) {
          return res.status(400).json({ error: 'Google not configured' });
        }
        const gemini = google.getGenerativeModel({ model });
        const chat = gemini.startChat({
          generationConfig: { temperature, maxOutputTokens: max_tokens }
        });
        const result = await chat.sendMessage(messages[messages.length - 1].content);
        response = {
          choices: [{
            message: {
              content: result.response.text()
            }
          }]
        };
        break;

      case 'groq':
        if (!groq) {
          return res.status(400).json({ error: 'Groq not configured' });
        }
        response = await groq.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        usage = response.usage;
        break;

      case 'xai':
        if (!xai) {
          return res.status(400).json({ error: 'xAI not configured' });
        }
        response = await xai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        usage = response.usage;
        break;

      case 'deepseek':
        if (!deepseek) {
          return res.status(400).json({ error: 'Deepseek not configured' });
        }
        response = await deepseek.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        usage = response.usage;
        break;

      case 'openrouter':
        if (!openrouter) {
          return res.status(400).json({ error: 'OpenRouter not configured' });
        }
        response = await openrouter.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        usage = response.usage;
        break;

      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    res.json({
      choices: response.choices,
      usage
    });

  } catch (error) {
    console.error('Chat completion error:', error);
    
    // Enhanced error handling
    if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else if (error.status === 401) {
      res.status(401).json({ error: 'API authentication error. Please check your configuration.' });
    } else if (error.status === 400) {
      res.status(400).json({ error: error.message || 'Bad request' });
    } else {
      res.status(500).json({ error: 'Failed to generate response' });
    }
  }
});

// Usage tracking endpoint
app.post('/api/usage/track', authenticateToken, async (req, res) => {
  try {
    const { 
      model_id, model_name, prompt_tokens, completion_tokens, 
      total_tokens, cost, tokens, model, conversation_id 
    } = req.body;

    // Import our robust usage tracking
    const { trackTokenUsage, getModelTier } = await import('./services/usageTracker.js');
    
    const modelTier = getModelTier(model_id || model);
    
    await trackTokenUsage(pool, {
      userId: req.user.id,
      modelId: model_id || model,
      modelName: model_name || model,
      promptTokens: prompt_tokens || 0,
      completionTokens: completion_tokens || 0,
      totalTokens: total_tokens || tokens || 0,
      cost: cost || (total_tokens || tokens || 0) * 0.00001,
      conversationId: conversation_id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Usage tracking error:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Model providers endpoint - ALL OpenRouter models (complete list)
app.get('/api/models/providers', (req, res) => {
  console.log('Models providers endpoint hit');
  const providers = [
    {
      id: 'openrouter',
      name: 'All AI Models (OpenRouter)',
      models: [
        // 🔥 PREMIUM GPT MODELS
        { id: 'openai/gpt-5-chat', name: 'GPT-5 Chat', provider: 'openrouter', context: 400000 },
        { id: 'openai/gpt-5', name: 'GPT-5', provider: 'openrouter', context: 400000 },
        { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'openrouter', context: 400000 },
        { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', provider: 'openrouter', context: 400000 },
        { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'openrouter', context: 1047576 },
        { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openrouter', context: 1047576 },
        { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openrouter', context: 1047576 },
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openrouter', context: 128000 },
        { id: 'openai/o3-pro', name: 'o3 Pro', provider: 'openrouter', context: 200000 },
        { id: 'openai/o3', name: 'o3', provider: 'openrouter', context: 200000 },
        { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'openrouter', context: 200000 },
        { id: 'openai/o1-pro', name: 'o1-pro', provider: 'openrouter', context: 200000 },
        { id: 'openai/o1', name: 'o1', provider: 'openrouter', context: 200000 },
        { id: 'openai/o1-mini', name: 'o1-mini', provider: 'openrouter', context: 128000 },
        { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT-4o', provider: 'openrouter', context: 128000 },
        { id: 'openai/codex-mini', name: 'Codex Mini', provider: 'openrouter', context: 200000 },

        // 🔥 PREMIUM CLAUDE MODELS
        { id: 'anthropic/claude-opus-4.1', name: 'Claude Opus 4.1', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (thinking)', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'openrouter', context: 200000 },

        // 🔥 PREMIUM GEMINI MODELS
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash Lite', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'openrouter', context: 2000000 },
        { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'openrouter', context: 1000000 },
        { id: 'google/gemini-flash-1.5-8b', name: 'Gemini 1.5 Flash 8B', provider: 'openrouter', context: 1000000 },
        { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'openrouter', context: 96000 },
        { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', provider: 'openrouter', context: 96000 },
        { id: 'google/gemma-3-4b-it', name: 'Gemma 3 4B', provider: 'openrouter', context: 131072 },

        // 🔥 PREMIUM XAI MODELS
        { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'openrouter', context: 256000 },
        { id: 'x-ai/grok-3', name: 'Grok 3', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3-mini', name: 'Grok 3 Mini', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3-beta', name: 'Grok 3 Beta', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3-mini-beta', name: 'Grok 3 Mini Beta', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-2-1212', name: 'Grok 2 1212', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-2-vision-1212', name: 'Grok 2 Vision 1212', provider: 'openrouter', context: 32768 },
        { id: 'x-ai/grok-vision-beta', name: 'Grok Vision Beta', provider: 'openrouter', context: 8192 },

        // 🔥 PREMIUM OTHER MODELS
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter', context: 163840 },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'openrouter', context: 163840 },
        { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'openrouter', context: 1048576 },
        { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', provider: 'openrouter', context: 1048576 },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mistral-medium-3.1', name: 'Mistral Medium 3.1', provider: 'openrouter', context: 262144 },
        { id: 'mistralai/codestral-2501', name: 'Codestral 2501', provider: 'openrouter', context: 262144 },
        { id: 'qwen/qwen3-235b-a22b-2507', name: 'Qwen3 235B A22B Instruct', provider: 'openrouter', context: 262144 },
        { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', provider: 'openrouter', context: 262144 },
        { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Llama 3.1 Nemotron Ultra 253B v1', provider: 'openrouter', context: 131072 },
        { id: 'perplexity/sonar-pro', name: 'Sonar Pro', provider: 'openrouter', context: 200000 },
        { id: 'cohere/command-a', name: 'Command A', provider: 'openrouter', context: 32768 },

        // Additional Premium Models
        { id: 'z-ai/glm-4.5v', name: 'GLM 4.5V', provider: 'openrouter', context: 65536 },
        { id: 'ai21/jamba-mini-1.7', name: 'Jamba Mini 1.7', provider: 'openrouter', context: 256000 },
        { id: 'ai21/jamba-large-1.7', name: 'Jamba Large 1.7', provider: 'openrouter', context: 256000 },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/codestral-2508', name: 'Codestral 2508', provider: 'openrouter', context: 256000 },
        { id: 'qwen/qwen3-30b-a3b-instruct-2507', name: 'Qwen3 30B A3B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'z-ai/glm-4.5', name: 'GLM 4.5', provider: 'openrouter', context: 131072 },
        { id: 'qwen/qwen3-235b-a22b-thinking-2507', name: 'Qwen3 235B A22B Thinking', provider: 'openrouter', context: 262144 },
        { id: 'z-ai/glm-4-32b', name: 'GLM 4 32B', provider: 'openrouter', context: 128000 },
        { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', provider: 'openrouter', context: 262144 },
        { id: 'bytedance/ui-tars-1.5-7b', name: 'UI-TARS 7B', provider: 'openrouter', context: 128000 },
        { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'openrouter', context: 1048576 },
        { id: 'qwen/qwen3-235b-a22b-2507', name: 'Qwen3 235B A22B Instruct', provider: 'openrouter', context: 262144 },
        { id: 'switchpoint/router', name: 'Switchpoint Router', provider: 'openrouter', context: 131072 },
        { id: 'moonshotai/kimi-k2', name: 'Kimi K2', provider: 'openrouter', context: 63000 },
        { id: 'thudm/glm-4.1v-9b-thinking', name: 'GLM 4.1V 9B Thinking', provider: 'openrouter', context: 65536 },
        { id: 'mistralai/devstral-medium', name: 'Devstral Medium', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/devstral-small', name: 'Devstral Small 1.1', provider: 'openrouter', context: 128000 },
        { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'openrouter', context: 256000 },
        { id: 'tencent/hunyuan-a13b-instruct', name: 'Hunyuan A13B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'morph/morph-v3-large', name: 'Morph V3 Large', provider: 'openrouter', context: 81920 },
        { id: 'morph/morph-v3-fast', name: 'Morph V3 Fast', provider: 'openrouter', context: 81920 },
        { id: 'baidu/ernie-4.5-300b-a47b', name: 'ERNIE 4.5 300B A47B', provider: 'openrouter', context: 123000 },
        { id: 'thedrummer/anubis-70b-v1.1', name: 'Anubis 70B V1.1', provider: 'openrouter', context: 16384 },
        { id: 'inception/mercury', name: 'Mercury', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/mistral-small-3.2-24b-instruct', name: 'Mistral Small 3.2 24B', provider: 'openrouter', context: 131072 },
        { id: 'minimax/minimax-m1', name: 'MiniMax M1', provider: 'openrouter', context: 1000000 },
        { id: 'google/gemini-2.5-flash-lite-preview-06-17', name: 'Gemini 2.5 Flash Lite Preview', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'openrouter', context: 1048576 },
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter', context: 1048576 },
        { id: 'openai/o3-pro', name: 'o3 Pro', provider: 'openrouter', context: 200000 },
        { id: 'x-ai/grok-3-mini', name: 'Grok 3 Mini', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3', name: 'Grok 3', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/magistral-small-2506', name: 'Magistral Small 2506', provider: 'openrouter', context: 40000 },
        { id: 'mistralai/magistral-medium-2506', name: 'Magistral Medium 2506', provider: 'openrouter', context: 40960 },
        { id: 'mistralai/magistral-medium-2506:thinking', name: 'Magistral Medium 2506 (thinking)', provider: 'openrouter', context: 40960 },
        { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro Preview 06-05', provider: 'openrouter', context: 1048576 },
        { id: 'deepseek/deepseek-r1-0528-qwen3-8b', name: 'Deepseek R1 0528 Qwen3 8B', provider: 'openrouter', context: 32000 },
        { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1 0528', provider: 'openrouter', context: 163840 },
        { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter', context: 200000 },
        { id: 'mistralai/devstral-small-2505', name: 'Devstral Small 2505', provider: 'openrouter', context: 131072 },
        { id: 'google/gemma-3n-e4b-it', name: 'Gemma 3n 4B', provider: 'openrouter', context: 32768 },
        { id: 'openai/codex-mini', name: 'Codex Mini', provider: 'openrouter', context: 200000 },
        { id: 'nousresearch/deephermes-3-mistral-24b-preview', name: 'DeepHermes 3 Mistral 24B Preview', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mistral-medium-3', name: 'Mistral Medium 3', provider: 'openrouter', context: 131072 },
        { id: 'google/gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro Preview 05-06', provider: 'openrouter', context: 1048576 },
        { id: 'arcee-ai/spotlight', name: 'Spotlight', provider: 'openrouter', context: 131072 },
        { id: 'arcee-ai/maestro-reasoning', name: 'Maestro Reasoning', provider: 'openrouter', context: 131072 },
        { id: 'arcee-ai/virtuoso-large', name: 'Virtuoso Large', provider: 'openrouter', context: 131072 },
        { id: 'arcee-ai/coder-large', name: 'Coder Large', provider: 'openrouter', context: 32768 },
        { id: 'microsoft/phi-4-reasoning-plus', name: 'Phi 4 Reasoning Plus', provider: 'openrouter', context: 32768 },
        { id: 'inception/mercury-coder', name: 'Mercury Coder', provider: 'openrouter', context: 128000 },
        { id: 'opengvlab/internvl3-14b', name: 'InternVL3 14B', provider: 'openrouter', context: 12288 },
        { id: 'deepseek/deepseek-prover-v2', name: 'DeepSeek Prover V2', provider: 'openrouter', context: 163840 },
        { id: 'meta-llama/llama-guard-4-12b', name: 'Llama Guard 4 12B', provider: 'openrouter', context: 163840 },
        { id: 'qwen/qwen3-30b-a3b', name: 'Qwen3 30B A3B', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-8b', name: 'Qwen3 8B', provider: 'openrouter', context: 128000 },
        { id: 'qwen/qwen3-14b', name: 'Qwen3 14B', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B A22B', provider: 'openrouter', context: 40960 },
        { id: 'tngtech/deepseek-r1t-chimera', name: 'DeepSeek R1T Chimera', provider: 'openrouter', context: 163840 },
        { id: 'microsoft/mai-ds-r1', name: 'MAI DS R1', provider: 'openrouter', context: 163840 },
        { id: 'thudm/glm-z1-32b', name: 'GLM Z1 32B', provider: 'openrouter', context: 32768 },
        { id: 'thudm/glm-4-32b', name: 'GLM 4 32B', provider: 'openrouter', context: 32000 },
        { id: 'openai/o4-mini-high', name: 'o4 Mini High', provider: 'openrouter', context: 200000 },
        { id: 'openai/o3', name: 'o3', provider: 'openrouter', context: 200000 },
        { id: 'openai/o4-mini', name: 'o4 Mini', provider: 'openrouter', context: 200000 },
        { id: 'shisa-ai/shisa-v2-llama3.3-70b', name: 'Shisa V2 Llama 3.3 70B', provider: 'openrouter', context: 32768 },
        { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'openrouter', context: 1047576 },
        { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openrouter', context: 1047576 },
        { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openrouter', context: 1047576 },
        { id: 'eleutherai/llemma_7b', name: 'Llemma 7b', provider: 'openrouter', context: 4096 },
        { id: 'alfredpros/codellama-7b-instruct-solidity', name: 'CodeLLaMa 7B Instruct Solidity', provider: 'openrouter', context: 8192 },
        { id: 'arliai/qwq-32b-arliai-rpr-v1', name: 'QwQ 32B RpR v1', provider: 'openrouter', context: 32768 },
        { id: 'agentica-org/deepcoder-14b-preview', name: 'Deepcoder 14B Preview', provider: 'openrouter', context: 96000 },
        { id: 'moonshotai/kimi-vl-a3b-thinking', name: 'Kimi VL A3B Thinking', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3-mini-beta', name: 'Grok 3 Mini Beta', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-3-beta', name: 'Grok 3 Beta', provider: 'openrouter', context: 131072 },
        { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Llama 3.3 Nemotron Super 49B v1', provider: 'openrouter', context: 131072 },
        { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', name: 'Llama 3.1 Nemotron Ultra 253B v1', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'openrouter', context: 1048576 },
        { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', provider: 'openrouter', context: 1048576 },
        { id: 'deepseek/deepseek-v3-base', name: 'DeepSeek V3 Base', provider: 'openrouter', context: 163840 },
        { id: 'scb10x/llama3.1-typhoon2-70b-instruct', name: 'Typhoon2 70B Instruct', provider: 'openrouter', context: 8192 },
        { id: 'google/gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro Experimental', provider: 'openrouter', context: 1048576 },
        { id: 'qwen/qwen2.5-vl-32b-instruct', name: 'Qwen2.5 VL 32B Instruct', provider: 'openrouter', context: 16384 },
        { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3 0324', provider: 'openrouter', context: 163840 },
        { id: 'openai/o1-pro', name: 'o1-pro', provider: 'openrouter', context: 200000 },
        { id: 'mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1 24B', provider: 'openrouter', context: 131072 },
        { id: 'google/gemma-3-4b-it', name: 'Gemma 3 4B', provider: 'openrouter', context: 131072 },
        { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B', provider: 'openrouter', context: 96000 },
        { id: 'cohere/command-a', name: 'Command A', provider: 'openrouter', context: 32768 },
        { id: 'openai/gpt-4o-mini-search-preview', name: 'GPT-4o-mini Search Preview', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-4o-search-preview', name: 'GPT-4o Search Preview', provider: 'openrouter', context: 128000 },
        { id: 'google/gemma-3-27b-it', name: 'Gemma 3 27B', provider: 'openrouter', context: 96000 },
        { id: 'thedrummer/anubis-pro-105b-v1', name: 'Anubis Pro 105B V1', provider: 'openrouter', context: 131072 },
        { id: 'thedrummer/skyfall-36b-v2', name: 'Skyfall 36B V2', provider: 'openrouter', context: 32768 },
        { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi 4 Multimodal Instruct', provider: 'openrouter', context: 131072 },
        { id: 'perplexity/sonar-reasoning-pro', name: 'Sonar Reasoning Pro', provider: 'openrouter', context: 128000 },
        { id: 'perplexity/sonar-pro', name: 'Sonar Pro', provider: 'openrouter', context: 200000 },
        { id: 'perplexity/sonar-deep-research', name: 'Sonar Deep Research', provider: 'openrouter', context: 128000 },
        { id: 'qwen/qwq-32b', name: 'QwQ 32B', provider: 'openrouter', context: 131072 },
        { id: 'google/gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash Lite', provider: 'openrouter', context: 1048576 },
        { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (thinking)', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.7-sonnet:beta', name: 'Claude 3.7 Sonnet (self-moderated)', provider: 'openrouter', context: 200000 },
        { id: 'perplexity/r1-1776', name: 'R1 1776', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/mistral-saba', name: 'Saba', provider: 'openrouter', context: 32768 },
        { id: 'cognitivecomputations/dolphin3.0-r1-mistral-24b', name: 'Dolphin3.0 R1 Mistral 24B', provider: 'openrouter', context: 32768 },
        { id: 'cognitivecomputations/dolphin3.0-mistral-24b', name: 'Dolphin3.0 Mistral 24B', provider: 'openrouter', context: 32768 },
        { id: 'meta-llama/llama-guard-3-8b', name: 'Llama Guard 3 8B', provider: 'openrouter', context: 131072 },
        { id: 'openai/o3-mini-high', name: 'o3 Mini High', provider: 'openrouter', context: 200000 },
        { id: 'deepseek/deepseek-r1-distill-llama-8b', name: 'R1 Distill Llama 8B', provider: 'openrouter', context: 32000 },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'openrouter', context: 1048576 },
        { id: 'qwen/qwen-vl-plus', name: 'Qwen VL Plus', provider: 'openrouter', context: 7500 },
        { id: 'aion-labs/aion-1.0', name: 'Aion-1.0', provider: 'openrouter', context: 131072 },
        { id: 'aion-labs/aion-1.0-mini', name: 'Aion-1.0-Mini', provider: 'openrouter', context: 131072 },
        { id: 'aion-labs/aion-rp-llama-3.1-8b', name: 'Aion-RP 1.0 (8B)', provider: 'openrouter', context: 32768 },
        { id: 'qwen/qwen-vl-max', name: 'Qwen VL Max', provider: 'openrouter', context: 7500 },
        { id: 'qwen/qwen-turbo', name: 'Qwen-Turbo', provider: 'openrouter', context: 1000000 },
        { id: 'qwen/qwen2.5-vl-72b-instruct', name: 'Qwen2.5 VL 72B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'qwen/qwen-plus', name: 'Qwen-Plus', provider: 'openrouter', context: 131072 },
        { id: 'qwen/qwen-max', name: 'Qwen-Max', provider: 'openrouter', context: 32768 },
        { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'openrouter', context: 200000 },
        { id: 'deepseek/deepseek-r1-distill-qwen-1.5b', name: 'R1 Distill Qwen 1.5B', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/mistral-small-24b-instruct-2501', name: 'Mistral Small 3', provider: 'openrouter', context: 32768 },
        { id: 'deepseek/deepseek-r1-distill-qwen-32b', name: 'R1 Distill Qwen 32B', provider: 'openrouter', context: 131072 },
        { id: 'deepseek/deepseek-r1-distill-qwen-14b', name: 'R1 Distill Qwen 14B', provider: 'openrouter', context: 64000 },
        { id: 'perplexity/sonar-reasoning', name: 'Sonar Reasoning', provider: 'openrouter', context: 127000 },
        { id: 'perplexity/sonar', name: 'Sonar', provider: 'openrouter', context: 127072 },
        { id: 'liquid/lfm-7b', name: 'LFM 7B', provider: 'openrouter', context: 32768 },
        { id: 'liquid/lfm-3b', name: 'LFM 3B', provider: 'openrouter', context: 32768 },
        { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'R1 Distill Llama 70B', provider: 'openrouter', context: 131072 },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter', context: 163840 },
        { id: 'minimax/minimax-01', name: 'MiniMax-01', provider: 'openrouter', context: 1000192 },
        { id: 'mistralai/codestral-2501', name: 'Codestral 2501', provider: 'openrouter', context: 262144 },
        { id: 'microsoft/phi-4', name: 'Phi 4', provider: 'openrouter', context: 16384 },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'openrouter', context: 163840 },
        { id: 'sao10k/l3.3-euryale-70b', name: 'Llama 3.3 Euryale 70B', provider: 'openrouter', context: 131072 },
        { id: 'openai/o1', name: 'o1', provider: 'openrouter', context: 200000 },
        { id: 'x-ai/grok-2-vision-1212', name: 'Grok 2 Vision 1212', provider: 'openrouter', context: 32768 },
        { id: 'x-ai/grok-2-1212', name: 'Grok 2 1212', provider: 'openrouter', context: 131072 },
        { id: 'cohere/command-r7b-12-2024', name: 'Command R7B (12-2024)', provider: 'openrouter', context: 128000 },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'amazon/nova-lite-v1', name: 'Nova Lite 1.0', provider: 'openrouter', context: 300000 },
        { id: 'amazon/nova-micro-v1', name: 'Nova Micro 1.0', provider: 'openrouter', context: 128000 },
        { id: 'amazon/nova-pro-v1', name: 'Nova Pro 1.0', provider: 'openrouter', context: 300000 },
        { id: 'qwen/qwq-32b-preview', name: 'QwQ 32B Preview', provider: 'openrouter', context: 32768 },
        { id: 'openai/gpt-4o-2024-11-20', name: 'GPT-4o (2024-11-20)', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/mistral-large-2407', name: 'Mistral Large 2407', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/pixtral-large-2411', name: 'Pixtral Large 2411', provider: 'openrouter', context: 131072 },
        { id: 'x-ai/grok-vision-beta', name: 'Grok Vision Beta', provider: 'openrouter', context: 8192 },
        { id: 'infermatic/mn-inferor-12b', name: 'Mistral Nemo Inferor 12B', provider: 'openrouter', context: 8192 },
        { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'raifle/sorcererlm-8x22b', name: 'SorcererLM 8x22B', provider: 'openrouter', context: 16000 },
        { id: 'thedrummer/unslopnemo-12b', name: 'UnslopNemo 12B', provider: 'openrouter', context: 32768 },
        { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.5-haiku-20241022', name: 'Claude 3.5 Haiku (2024-10-22)', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter', context: 200000 },
        { id: 'anthracite-org/magnum-v4-72b', name: 'Magnum v4 72B', provider: 'openrouter', context: 16384 },
        { id: 'mistralai/ministral-8b', name: 'Ministral 8B', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/ministral-3b', name: 'Ministral 3B', provider: 'openrouter', context: 32768 },
        { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen2.5 7B Instruct', provider: 'openrouter', context: 65536 },
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'inflection/inflection-3-productivity', name: 'Inflection 3 Productivity', provider: 'openrouter', context: 8000 },
        { id: 'inflection/inflection-3-pi', name: 'Inflection 3 Pi', provider: 'openrouter', context: 8000 },
        { id: 'google/gemini-flash-1.5-8b', name: 'Gemini 1.5 Flash 8B', provider: 'openrouter', context: 1000000 },
        { id: 'thedrummer/rocinante-12b', name: 'Rocinante 12B', provider: 'openrouter', context: 8192 },
        { id: 'anthracite-org/magnum-v2-72b', name: 'Magnum v2 72B', provider: 'openrouter', context: 32768 },
        { id: 'liquid/lfm-40b', name: 'LFM 40B MoE', provider: 'openrouter', context: 65536 },
        { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision Instruct', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B Instruct', provider: 'openrouter', context: 20000 },
        { id: 'meta-llama/llama-3.2-1b-instruct', name: 'Llama 3.2 1B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision Instruct', provider: 'openrouter', context: 131072 },
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen2.5 72B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'neversleep/llama-3.1-lumimaid-8b', name: 'Lumimaid v0.2 8B', provider: 'openrouter', context: 40000 },
        { id: 'openai/o1-mini', name: 'o1-mini', provider: 'openrouter', context: 128000 },
        { id: 'openai/o1-mini-2024-09-12', name: 'o1-mini (2024-09-12)', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B', provider: 'openrouter', context: 32768 },
        { id: 'cohere/command-r-plus-08-2024', name: 'Command R+ (08-2024)', provider: 'openrouter', context: 128000 },
        { id: 'cohere/command-r-08-2024', name: 'Command R (08-2024)', provider: 'openrouter', context: 128000 },
        { id: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen2.5-VL 7B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'sao10k/l3.1-euryale-70b', name: 'Llama 3.1 Euryale 70B v2.2', provider: 'openrouter', context: 32768 },
        { id: 'microsoft/phi-3.5-mini-128k-instruct', name: 'Phi-3.5 Mini 128K Instruct', provider: 'openrouter', context: 128000 },
        { id: 'nousresearch/hermes-3-llama-3.1-70b', name: 'Hermes 3 70B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3 405B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT-4o', provider: 'openrouter', context: 128000 },
        { id: 'sao10k/l3-lunaris-8b', name: 'Llama 3 8B Lunaris', provider: 'openrouter', context: 8192 },
        { id: 'openai/gpt-4o-2024-08-06', name: 'GPT-4o (2024-08-06)', provider: 'openrouter', context: 128000 },
        { id: 'meta-llama/llama-3.1-405b', name: 'Llama 3.1 405B (base)', provider: 'openrouter', context: 32768 },
        { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', provider: 'openrouter', context: 32000 },
        { id: 'openai/gpt-4o-mini-2024-07-18', name: 'GPT-4o-mini (2024-07-18)', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o-mini', provider: 'openrouter', context: 128000 },
        { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'openrouter', context: 8192 },
        { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'openrouter', context: 8192 },
        { id: 'anthropic/claude-3.5-sonnet-20240620', name: 'Claude 3.5 Sonnet (2024-06-20)', provider: 'openrouter', context: 200000 },
        { id: 'sao10k/l3-euryale-70b', name: 'Llama 3 Euryale 70B v2.1', provider: 'openrouter', context: 8192 },
        { id: 'cognitivecomputations/dolphin-mixtral-8x22b', name: 'Dolphin 2.9.2 Mixtral 8x22B', provider: 'openrouter', context: 16000 },
        { id: 'qwen/qwen-2-72b-instruct', name: 'Qwen 2 72B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B Instruct v0.3', provider: 'openrouter', context: 32768 },
        { id: 'nousresearch/hermes-2-pro-llama-3-8b', name: 'Hermes 2 Pro - Llama-3 8B', provider: 'openrouter', context: 131072 },
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K Instruct', provider: 'openrouter', context: 128000 },
        { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K Instruct', provider: 'openrouter', context: 128000 },
        { id: 'neversleep/llama-3-lumimaid-70b', name: 'Llama 3 Lumimaid 70B', provider: 'openrouter', context: 8192 },
        { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', provider: 'openrouter', context: 1000000 },
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-4o:extended', name: 'GPT-4o (extended)', provider: 'openrouter', context: 128000 },
        { id: 'meta-llama/llama-guard-2-8b', name: 'LlamaGuard 2 8B', provider: 'openrouter', context: 8192 },
        { id: 'openai/gpt-4o-2024-05-13', name: 'GPT-4o (2024-05-13)', provider: 'openrouter', context: 128000 },
        { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B Instruct', provider: 'openrouter', context: 8192 },
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B Instruct', provider: 'openrouter', context: 8192 },
        { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B Instruct', provider: 'openrouter', context: 65536 },
        { id: 'microsoft/wizardlm-2-8x22b', name: 'WizardLM-2 8x22B', provider: 'openrouter', context: 65536 },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openrouter', context: 128000 },
        { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'openrouter', context: 2000000 },
        { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'openrouter', context: 128000 },
        { id: 'cohere/command-r-plus-04-2024', name: 'Command R+ (04-2024)', provider: 'openrouter', context: 128000 },
        { id: 'sophosympatheia/midnight-rose-70b', name: 'Midnight Rose 70B', provider: 'openrouter', context: 4096 },
        { id: 'cohere/command', name: 'Command', provider: 'openrouter', context: 4096 },
        { id: 'cohere/command-r', name: 'Command R', provider: 'openrouter', context: 128000 },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'openrouter', context: 200000 },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'openrouter', context: 200000 },
        { id: 'cohere/command-r-03-2024', name: 'Command R (03-2024)', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'openrouter', context: 128000 },
        { id: 'openai/gpt-3.5-turbo-0613', name: 'GPT-3.5 Turbo (older v0613)', provider: 'openrouter', context: 4095 },
        { id: 'openai/gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', provider: 'openrouter', context: 128000 },
        { id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo', name: 'Hermes 2 Mixtral 8x7B DPO', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mistral-tiny', name: 'Mistral Tiny', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mistral-small', name: 'Mistral Small', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', provider: 'openrouter', context: 32768 },
        { id: 'neversleep/noromaid-20b', name: 'Noromaid 20B', provider: 'openrouter', context: 4096 },
        { id: 'alpindale/goliath-120b', name: 'Goliath 120B', provider: 'openrouter', context: 6144 },
        { id: 'openai/gpt-4-1106-preview', name: 'GPT-4 Turbo (older v1106)', provider: 'openrouter', context: 128000 },
        { id: 'mistralai/mistral-7b-instruct-v0.1', name: 'Mistral 7B Instruct v0.1', provider: 'openrouter', context: 2824 },
        { id: 'openai/gpt-3.5-turbo-instruct', name: 'GPT-3.5 Turbo Instruct', provider: 'openrouter', context: 4095 },
        { id: 'pygmalionai/mythalion-13b', name: 'Mythalion 13B', provider: 'openrouter', context: 4096 },
        { id: 'openai/gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16k', provider: 'openrouter', context: 16385 },
        { id: 'mancer/weaver', name: 'Weaver (alpha)', provider: 'openrouter', context: 8000 },
        { id: 'undi95/remm-slerp-l2-13b', name: 'ReMM SLERP 13B', provider: 'openrouter', context: 6144 },
        { id: 'gryphe/mythomax-l2-13b', name: 'MythoMax 13B', provider: 'openrouter', context: 4096 },
        { id: 'openai/gpt-4', name: 'GPT-4', provider: 'openrouter', context: 8191 },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openrouter', context: 16385 },
        { id: 'openai/gpt-4-0314', name: 'GPT-4 (older v0314)', provider: 'openrouter', context: 8191 },
        
        // Free Models
        { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B (Free)', provider: 'openrouter', context: 131072 },
        { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)', provider: 'openrouter', context: 131072 },
        { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder (Free)', provider: 'openrouter', context: 262144 },
        { id: 'moonshotai/kimi-k2:free', name: 'Kimi K2 (Free)', provider: 'openrouter', context: 32768 },
        { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name: 'Venice Uncensored (Free)', provider: 'openrouter', context: 32768 },
        { id: 'google/gemma-3n-e2b-it:free', name: 'Gemma 3n 2B (Free)', provider: 'openrouter', context: 8192 },
        { id: 'tencent/hunyuan-a13b-instruct:free', name: 'Hunyuan A13B Instruct (Free)', provider: 'openrouter', context: 32768 },
        { id: 'tngtech/deepseek-r1t2-chimera:free', name: 'DeepSeek R1T2 Chimera (Free)', provider: 'openrouter', context: 163840 },
        { id: 'mistralai/mistral-small-3.2-24b-instruct:free', name: 'Mistral Small 3.2 24B (Free)', provider: 'openrouter', context: 131072 },
        { id: 'moonshotai/kimi-dev-72b:free', name: 'Kimi Dev 72B (Free)', provider: 'openrouter', context: 131072 },
        { id: 'deepseek/deepseek-r1-0528-qwen3-8b:free', name: 'Deepseek R1 0528 Qwen3 8B (Free)', provider: 'openrouter', context: 131072 },
        { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 0528 (Free)', provider: 'openrouter', context: 163840 },
        { id: 'sarvamai/sarvam-m:free', name: 'Sarvam-M (Free)', provider: 'openrouter', context: 32768 },
        { id: 'mistralai/devstral-small-2505:free', name: 'Devstral Small 2505 (Free)', provider: 'openrouter', context: 32768 },
        { id: 'google/gemma-3n-e4b-it:free', name: 'Gemma 3n 4B (Free)', provider: 'openrouter', context: 8192 },
        { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B (Free)', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B A3B (Free)', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-8b:free', name: 'Qwen3 8B (Free)', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-14b:free', name: 'Qwen3 14B (Free)', provider: 'openrouter', context: 40960 },
        { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B A22B (Free)', provider: 'openrouter', context: 131072 },
        { id: 'tngtech/deepseek-r1t-chimera:free', name: 'DeepSeek R1T Chimera (Free)', provider: 'openrouter', context: 163840 },
        { id: 'microsoft/mai-ds-r1:free', name: 'MAI DS R1 (Free)', provider: 'openrouter', context: 163840 },
        { id: 'shisa-ai/shisa-v2-llama3.3-70b:free', name: 'Shisa V2 Llama 3.3 70B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'arliai/qwq-32b-arliai-rpr-v1:free', name: 'QwQ 32B RpR v1 (Free)', provider: 'openrouter', context: 32768 },
        { id: 'agentica-org/deepcoder-14b-preview:free', name: 'Deepcoder 14B Preview (Free)', provider: 'openrouter', context: 96000 },
        { id: 'moonshotai/kimi-vl-a3b-thinking:free', name: 'Kimi VL A3B Thinking (Free)', provider: 'openrouter', context: 131072 },
        { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free', name: 'Llama 3.1 Nemotron Ultra 253B v1 (Free)', provider: 'openrouter', context: 131072 },
        { id: 'google/gemini-2.5-flash-exp:free', name: 'Gemini 2.5 Flash Experimental (Free)', provider: 'openrouter', context: 1048576 },
        { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', provider: 'openrouter', context: 65536 },
        { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B (Free)', provider: 'openrouter', context: 128000 },
        { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B (Free)', provider: 'openrouter', context: 96000 },
        { id: 'rekaai/reka-flash-3:free', name: 'Flash 3 (Free)', provider: 'openrouter', context: 32768 },
        { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (Free)', provider: 'openrouter', context: 96000 },
        { id: 'qwen/qwq-32b:free', name: 'QwQ 32B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'nousresearch/deephermes-3-llama-3-8b-preview:free', name: 'DeepHermes 3 Llama 3 8B Preview (Free)', provider: 'openrouter', context: 131072 },
        { id: 'cognitivecomputations/dolphin3.0-r1-mistral-24b:free', name: 'Dolphin3.0 R1 Mistral 24B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'cognitivecomputations/dolphin3.0-mistral-24b:free', name: 'Dolphin3.0 Mistral 24B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'deepseek/deepseek-r1-distill-llama-70b:free', name: 'R1 Distill Llama 70B (Free)', provider: 'openrouter', context: 8192 },
        { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'openrouter', context: 163840 },
        { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 3 (Free)', provider: 'openrouter', context: 32768 },
        { id: 'deepseek/deepseek-r1-distill-qwen-14b:free', name: 'R1 Distill Qwen 14B (Free)', provider: 'openrouter', context: 64000 },
        { id: 'qwen/qwen2.5-vl-32b-instruct:free', name: 'Qwen2.5 VL 32B Instruct (Free)', provider: 'openrouter', context: 8192 },
        { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 0324 (Free)', provider: 'openrouter', context: 163840 },
        { id: 'featherless/qwerky-72b:free', name: 'Qrwkv 72B (Free)', provider: 'openrouter', context: 32768 },
        { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', name: 'Llama 3.2 11B Vision Instruct (Free)', provider: 'openrouter', context: 131072 },
        { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct (Free)', provider: 'openrouter', context: 131072 },
        { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen2.5 72B Instruct (Free)', provider: 'openrouter', context: 32768 },
        { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen2.5 Coder 32B Instruct (Free)', provider: 'openrouter', context: 32768 },
        { id: 'meta-llama/llama-3.1-405b-instruct:free', name: 'Llama 3.1 405B Instruct (Free)', provider: 'openrouter', context: 65536 },
        { id: 'mistralai/mistral-nemo:free', name: 'Mistral Nemo (Free)', provider: 'openrouter', context: 131072 },
        { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', provider: 'openrouter', context: 8192 },
        { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', provider: 'openrouter', context: 32768 }
      ]
    }
  ];

  res.json({
    success: true,
    providers: providers
  });
});

// Models endpoints
app.get('/api/models', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM models WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.post('/api/models', authenticateToken, async (req, res) => {
  try {
    const { name, baseModel, systemInstructions, openingStatement, description, tags } = req.body;

    if (!name || !baseModel || !systemInstructions) {
      return res.status(400).json({ error: 'Name, base model, and system instructions are required' });
    }

    const result = await pool.query(`
      INSERT INTO models (user_id, name, base_model, system_prompt, system_instructions, opening_statement, description, tags, is_public)
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8)
      RETURNING *
    `, [req.user.id, name, baseModel, systemInstructions, openingStatement, description, tags, false]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

// Get specific model
app.get('/api/models/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM models WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

// Update model
app.put('/api/models/:id', authenticateToken, async (req, res) => {
  try {
    const { name, baseModel, systemInstructions, openingStatement, description, tags } = req.body;
    
    const result = await pool.query(`
      UPDATE models 
      SET name = $1, base_model = $2, system_prompt = $3, system_instructions = $3, opening_statement = $4, description = $5, tags = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [name, baseModel, systemInstructions, openingStatement, description, tags, req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating model:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

// Delete model
app.delete('/api/models/:id', authenticateToken, async (req, res) => {
  try {
    // First delete associated documents
    await pool.query('DELETE FROM documents WHERE model_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    
    // Then delete the model
    const result = await pool.query(
      'DELETE FROM models WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Share model
app.post('/api/models/:id/share', authenticateToken, async (req, res) => {
  try {
    const shareToken = crypto.randomUUID();
    
    const result = await pool.query(`
      UPDATE models 
      SET is_public = true, share_token = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [shareToken, req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json({ shareToken, model: result.rows[0] });
  } catch (error) {
    console.error('Error sharing model:', error);
    res.status(500).json({ error: 'Failed to share model' });
  }
});

// Import model
app.post('/api/models/import', authenticateToken, async (req, res) => {
  try {
    const { shareToken } = req.body;
    
    if (!shareToken) {
      return res.status(400).json({ error: 'Share token is required' });
    }
    
    // Find the model to import
    const originalResult = await pool.query(
      'SELECT * FROM models WHERE share_token = $1 AND is_public = true',
      [shareToken]
    );
    
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found or not shared' });
    }
    
    const original = originalResult.rows[0];
    
    // Create imported copy
    const result = await pool.query(`
      INSERT INTO models (user_id, name, base_model, system_prompt, system_instructions, opening_statement, description, tags, is_imported, original_model_id)
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7, true, $8)
      RETURNING *
    `, [
      req.user.id,
      `${original.name} (Imported)`,
      original.base_model,
      original.system_prompt || original.system_instructions,
      original.opening_statement,
      original.description,
      original.tags,
      original.id
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error importing model:', error);
    res.status(500).json({ error: 'Failed to import model' });
  }
});

// Get community models
app.get('/api/models/community', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.name as owner_name, u.email as owner_email
      FROM models m
      JOIN users u ON m.user_id = u.id
      WHERE m.is_public = true
      ORDER BY m.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching community models:', error);
    res.status(500).json({ error: 'Failed to fetch community models' });
  }
});

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 3 // Maximum 3 files
  },
  fileFilter: (req, file, cb) => {
    // Allow text files, PDFs, and documents
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only text, PDF, Word, and CSV files are allowed.'));
    }
  }
});

// Upload documents to model
app.post('/api/models/:id/documents', authenticateToken, upload.array('documents', 3), async (req, res) => {
  try {
    // Check model ownership
    const modelResult = await pool.query(
      'SELECT id FROM models WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedDocs = [];
    
    for (const file of req.files) {
      let content = '';
      
      try {
        // Extract text content based on file type
        if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || file.mimetype === 'application/json') {
          content = file.buffer.toString('utf-8');
        } else if (file.mimetype === 'application/pdf') {
          // Parse PDF content (dynamic import to avoid loading issues)
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(file.buffer);
            content = pdfData.text;
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);
            content = `[PDF parsing failed: ${pdfError.message}]`;
          }
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // Parse DOCX content
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          content = result.value;
        } else if (file.mimetype === 'application/rtf' || file.mimetype === 'text/rtf') {
          // Parse RTF content (dynamic import to avoid loading issues)
          try {
            const rtfParser = (await import('rtf-parser')).default;
            const rtfData = rtfParser.parseRtf(file.buffer.toString());
            content = rtfData.content.map(item => item.text || '').join('\n');
          } catch (rtfError) {
            console.error('RTF parsing error:', rtfError);
            content = `[RTF parsing failed: ${rtfError.message}]`;
          }
        } else {
          content = `[Unsupported file type: ${file.mimetype}]`;
        }
        
        // Ensure content is not empty
        if (!content.trim()) {
          content = `[No text content extracted from ${file.originalname}]`;
        }
      } catch (parseError) {
        console.error(`Error parsing file ${file.originalname}:`, parseError);
        content = `[Error parsing ${file.originalname}: ${parseError.message}]`;
      }
      
      // Save document to database
      const result = await pool.query(`
        INSERT INTO documents (user_id, model_id, original_name, filename, file_type, file_size, content)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        req.user.id,
        req.params.id,
        file.originalname,
        `${Date.now()}_${file.originalname}`,
        file.mimetype,
        file.size,
        content
      ]);
      
      uploadedDocs.push(result.rows[0]);
    }
    
    // Auto-append document content to model's system instructions
    if (uploadedDocs.length > 0) {
      // Get current model system instructions
      const modelQuery = await pool.query(
        'SELECT system_prompt, system_instructions FROM models WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      
      if (modelQuery.rows.length > 0) {
        const currentInstructions = modelQuery.rows[0].system_prompt || modelQuery.rows[0].system_instructions || '';
        
        // Prepare document content to append
        const documentSections = uploadedDocs.map(doc => {
          return `\n\n--- Document: ${doc.original_name} ---\n${doc.content}`;
        }).join('');
        
        const updatedInstructions = currentInstructions + 
          (currentInstructions ? '\n\n' : '') + 
          '--- Uploaded Documents ---' + 
          documentSections;
        
        // Update model with new system instructions (both columns for compatibility)
        await pool.query(
          'UPDATE models SET system_prompt = $1, system_instructions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
          [updatedInstructions, req.params.id, req.user.id]
        );
        
        console.log(`✅ Auto-appended ${uploadedDocs.length} document(s) to model ${req.params.id} system instructions`);
      }
    }
    
    res.status(201).json({
      success: true,
      documents: uploadedDocs
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// Get documents for a model
app.get('/api/models/:id/documents', authenticateToken, async (req, res) => {
  try {
    // Check model ownership
    const modelResult = await pool.query(
      'SELECT id FROM models WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const result = await pool.query(
      'SELECT id, original_name, filename, file_type, file_size, created_at FROM documents WHERE model_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [req.params.id, req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get document content for AI context
app.get('/api/models/:id/documents/content', authenticateToken, async (req, res) => {
  try {
    // Check model ownership
    const modelResult = await pool.query(
      'SELECT id FROM models WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    const result = await pool.query(
      'SELECT original_name, content FROM documents WHERE model_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching document content:', error);
    res.status(500).json({ error: 'Failed to fetch document content' });
  }
});

// Delete document
app.delete('/api/models/:modelId/documents/:docId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND model_id = $2 AND user_id = $3 RETURNING id',
      [req.params.docId, req.params.modelId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// User profile endpoint
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, subscription_tier, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Alternative auth endpoint that frontend expects
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, subscription_tier, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Usage stats endpoint
// Robust tier-based usage stats endpoint
app.get('/api/usage/stats', authenticateToken, async (req, res) => {
  try {
    const { getUserUsageStats, getDailyUsageByTier } = await import('./services/usageTracker.js');
    
    // Get comprehensive usage statistics
    const stats = await getUserUsageStats(pool, req.user.id);
    
    // Legacy compatibility for old usage monitoring
    const totalTokens = Object.values(stats.todayUsage).reduce((sum, tokens) => sum + tokens, 0);
    
    res.json({
      // New tier-based data
      userPlan: stats.userPlan,
      todayUsage: stats.todayUsage,
      remainingTokens: stats.remainingTokens,
      planLimits: stats.planLimits,
      
      // Legacy compatibility
      totalTokens: totalTokens,
      totalConversations: stats.historicalData.length,
      totalCost: stats.historicalData.reduce((sum, day) => sum + parseFloat(day.daily_cost || 0), 0),
      
      // Historical data for analytics
      historicalData: stats.historicalData
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// Check if user can use a specific model (pre-flight check)
app.post('/api/usage/check', authenticateToken, async (req, res) => {
  try {
    const { modelId, estimatedTokens = 4000 } = req.body;
    
    if (!modelId) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    const { canUseModelTier } = await import('./services/usageTracker.js');
    
    const usageCheck = await canUseModelTier(pool, req.user.id, modelId, estimatedTokens);
    
    res.json({
      allowed: usageCheck.allowed,
      modelTier: usageCheck.modelTier,
      userPlan: usageCheck.userPlan,
      currentUsage: usageCheck.currentUsage,
      dailyLimit: usageCheck.dailyLimit,
      remainingTokens: usageCheck.remainingTokens,
      reason: usageCheck.reason,
      message: usageCheck.allowed 
        ? `You can use this ${usageCheck.modelTier} model. ${usageCheck.remainingTokens === Number.MAX_SAFE_INTEGER ? 'Unlimited' : `${usageCheck.remainingTokens} tokens remaining today`}.`
        : `Daily limit exceeded for ${usageCheck.modelTier} models. Usage: ${usageCheck.currentUsage}/${usageCheck.dailyLimit} tokens. Upgrade for higher limits.`
    });
    
  } catch (error) {
    console.error('Error checking usage limits:', error);
    res.status(500).json({ error: 'Failed to check usage limits' });
  }
});

// Conversations endpoint
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { id, title, modelA, modelB } = req.body;
    
    const result = await pool.query(`
      INSERT INTO conversations (user_id, title, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      RETURNING *
    `, [req.user.id, title]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Simple test endpoint
app.get('/test-endpoint-new', (req, res) => {
  res.json({ message: 'New endpoint working!' });
});

// Catch-all handler: send back React's index.html file for non-API routes
app.get('*', (req, res) => {
  console.log('Catch-all route hit:', req.path);
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/health') && !req.path.startsWith('/debug/') && !req.path.startsWith('/test-endpoint')) {
    const indexPath = join(__dirname, '../dist/index.html');
    console.log('Attempting to serve:', indexPath);
    
    // Check if file exists
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('Index.html not found at:', indexPath);
      res.status(404).send('Frontend not found');
    }
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// Start server after database initialization
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Debug status: http://localhost:${PORT}/debug/status`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});