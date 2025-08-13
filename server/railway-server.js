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
const dbDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
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
    const { model, messages, temperature = 0.7, max_tokens = 1000, provider } = req.body;
    
    console.log(`Chat request - Model: ${model}, Provider: ${provider}, Full body:`, JSON.stringify({model, provider}, null, 2));
    
    // Determine provider from explicit provider field or model ID
    let response;
    
    // Handle OpenRouter models first (based on provider field or model ID pattern)
    const isOpenRouterModel = provider === 'openrouter' || model.includes('/');
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
    }
    
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
    let providers = [];

    // Add OpenRouter first if key is available
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          // MISTRAL MODELS (OPENROUTER EXCLUSIVE)
          { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'mistralai/codestral-2508', name: 'Codestral 2508 (Code)', provider: 'openrouter', requiresKey: true, context: 32768 },
          { id: 'mistralai/pixtral-large-2411', name: 'Pixtral Large (Vision)', provider: 'openrouter', requiresKey: true, context: 128000 },
          { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B (Vision)', provider: 'openrouter', requiresKey: true, context: 128000 },
          
          // QWEN MODELS (OPENROUTER EXCLUSIVE)  
          { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'qwen/qwen-turbo', name: 'Qwen Turbo', provider: 'openrouter', requiresKey: true, context: 1000000 },
          
          // COHERE MODELS (OPENROUTER EXCLUSIVE)
          { id: 'cohere/command-r-plus-08-2024', name: 'Cohere Command R+', provider: 'openrouter', requiresKey: true, context: 128000 },
          
          // META MODELS (LARGER SIZES NOT AVAILABLE ELSEWHERE)
          { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (Largest)', provider: 'openrouter', requiresKey: true, context: 131072 },
          { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', provider: 'openrouter', requiresKey: true, context: 131072 }
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