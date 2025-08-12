import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
// We'll import pdf-parse dynamically when needed
import mammoth from 'mammoth';
import rtfParser from 'rtf-parser';
import billingRouter from './billing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const db = new Database(join(__dirname, 'database.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS multiplayer_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin TEXT UNIQUE NOT NULL,
    host_id INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting',
    setup_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS multiplayer_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_pin TEXT NOT NULL,
    message_type TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_pin) REFERENCES multiplayer_sessions(pin)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'explore',
    subscription_status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    base_model TEXT NOT NULL,
    system_instructions TEXT NOT NULL,
    opening_statement TEXT NOT NULL,
    is_public BOOLEAN DEFAULT 0,
    is_imported BOOLEAN DEFAULT 0,
    original_model_id INTEGER,
    original_owner_name TEXT,
    original_owner_email TEXT,
    share_token TEXT UNIQUE,
    share_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS model_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    content TEXT,
    file_path TEXT,
    file_type TEXT,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES custom_models (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    conversation_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT,
    model_a TEXT,
    model_b TEXT,
    message_count INTEGER DEFAULT 0,
    is_live BOOLEAN DEFAULT 0,
    share_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS imported_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_model_id INTEGER NOT NULL,
    share_token TEXT NOT NULL,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (original_model_id) REFERENCES custom_models (id)
  );

  CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    host_user_id INTEGER NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    viewer_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id),
    FOREIGN KEY (host_user_id) REFERENCES users (id)
  );
  
  CREATE TABLE IF NOT EXISTS live_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_code TEXT NOT NULL,
    message_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (share_code) REFERENCES live_sessions (share_code)
  );

  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    model_token TEXT NOT NULL,
    tags TEXT, -- JSON array as string
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    is_trending BOOLEAN DEFAULT 0,
    is_popular BOOLEAN DEFAULT 0,
    boost_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS community_post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    cost REAL NOT NULL,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_imported_models_user_id ON imported_models(user_id);
  CREATE INDEX IF NOT EXISTS idx_custom_models_share_token ON custom_models(share_token);
  CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_community_post_likes_post_user ON community_post_likes(post_id, user_id);
`);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any localhost port for development
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    // Otherwise reject
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Serve static files from dist directory
const distPath = join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Billing routes
app.use('/api/billing', billingRouter);

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 3 // Maximum 3 files
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF, DOCX, and RTF files
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/rtf',
      'text/rtf'
    ];
    
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['pdf', 'docx', 'rtf'];
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and RTF files are allowed.'));
    }
  }
});

// Document text extraction function
const extractTextFromDocument = async (filePath, mimeType, originalName) => {
  try {
    const fileExtension = originalName.toLowerCase().split('.').pop();
    const fileBuffer = fs.readFileSync(filePath);

    switch (fileExtension) {
      case 'pdf':
        const pdfParse = (await import('pdf-parse')).default;
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
        
      case 'docx':
        const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
        return docxResult.value;
        
      case 'rtf':
        return new Promise((resolve, reject) => {
          rtfParser.parseRtf(fileBuffer.toString(), (err, doc) => {
            if (err) {
              reject(err);
            } else {
              // Extract text content from RTF document
              const extractTextFromNode = (node) => {
                if (!node) return '';
                if (typeof node === 'string') return node;
                if (node.content) {
                  if (Array.isArray(node.content)) {
                    return node.content.map(extractTextFromNode).join('');
                  } else {
                    return extractTextFromNode(node.content);
                  }
                }
                return '';
              };
              const text = extractTextFromNode(doc);
              resolve(text);
            }
          });
        });
        
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw error;
  }
};

// Helper function to generate share tokens
const generateShareToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) token += '-';
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Authentication middleware
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

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(
      email,
      hashedPassword,
      name
    );

    // Generate token
    const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: result.lastInsertRowid,
        email,
        name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, name, subscription_tier FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Custom models routes
// Get available models from all providers (public endpoint)
app.get('/api/models/providers', async (req, res) => {
  const providers = [];
  
  try {
    console.log('Env check:', {
      openai: !!process.env.VITE_OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      google: !!process.env.GOOGLE_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      xai: !!process.env.XAI_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY
    });
    
    // OpenAI Models - Stable and working models only
    if (process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
      providers.push({
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o (Latest)', provider: 'openai', context: 128000 },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', context: 128000 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', context: 128000 },
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', context: 8192 },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', context: 16385 }
        ]
      });
    }

    // Claude Models (Anthropic) - Latest available models
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({
        id: 'anthropic',
        name: 'Anthropic (Claude)',
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', provider: 'anthropic', context: 200000 }
        ]
      });
    }

    // Groq Models - Ultra-fast inference with verified working models
    if (process.env.GROQ_API_KEY) {
      providers.push({
        id: 'groq',
        name: 'Groq',
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Latest)', provider: 'groq', context: 131072 },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', context: 131072 }
        ]
      });
    }

    // Google Gemini Models - Latest available versions
    if (process.env.GOOGLE_API_KEY) {
      providers.push({
        id: 'google',
        name: 'Google (Gemini)',
        models: [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', context: 2000000 },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', context: 1000000 },
          { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', provider: 'google', context: 1000000 }
        ]
      });
    }

    // XAI Grok Models - Currently available models
    if (process.env.XAI_API_KEY) {
      providers.push({
        id: 'xai',
        name: 'xAI (Grok)',
        models: [
          { id: 'grok-2-1212', name: 'Grok 2 (Latest)', provider: 'xai', context: 131072 },
          { id: 'grok-beta', name: 'Grok Beta', provider: 'xai', context: 131072 }
        ]
      });
    }

    // Perplexity removed - models not working properly

    // Deepseek Models - Advanced reasoning and coding capabilities
    if (process.env.DEEPSEEK_API_KEY) {
      providers.push({
        id: 'deepseek',
        name: 'Deepseek',
        models: [
          { id: 'deepseek-chat', name: 'Deepseek Chat (Latest)', provider: 'deepseek', context: 32768 },
          { id: 'deepseek-coder', name: 'Deepseek Coder', provider: 'deepseek', context: 16384 }
        ]
      });
    }

    res.json({ success: true, providers });
  } catch (error) {
    console.error('Error fetching provider models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Unified Chat Completion Endpoint
app.post('/api/chat/completions', authenticateToken, async (req, res) => {
  try {
    // Check user's token usage limit first
    const userUsage = db.prepare(`
      SELECT SUM(total_tokens) as total_tokens FROM usage_logs WHERE user_id = ?
    `).get(req.user.id);

    // Get fresh user data from database (not from JWT token)
    const currentUser = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user.id);
    console.log('Token check - User ID:', req.user.id, 'DB result:', currentUser, 'Current usage:', userUsage?.total_tokens);
    const userTier = currentUser?.subscription_tier || 'explore';
    const tierLimits = {
      explore: 50000,
      starter: 250000,
      professional: 750000,
      enterprise: 3000000
    };

    const currentUsage = userUsage?.total_tokens || 0;
    const tierLimit = tierLimits[userTier] || 50000;

    if (currentUsage >= tierLimit) {
      return res.status(429).json({ 
        error: `Token limit exceeded. You've used ${currentUsage.toLocaleString()} tokens out of your ${tierLimit.toLocaleString()} token limit on the ${userTier} plan. Please upgrade your plan to continue.`,
        usage: currentUsage,
        limit: tierLimit,
        tier: userTier
      });
    }

    const { provider, model, messages, temperature = 0.7, max_tokens = 4000 } = req.body;
    
    if (!provider || !model || !messages) {
      return res.status(400).json({ error: 'Provider, model, and messages are required' });
    }

    let response;
    let content;
    let usage;

    switch (provider) {
      case 'openai': {
        if (!process.env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
          return res.status(500).json({ error: 'OpenAI API key not configured' });
        }
        
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
        });
        
        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens
        });
        
        content = completion.choices[0]?.message?.content || '';
        usage = completion.usage;
        break;
      }
      
      case 'anthropic': {
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(500).json({ error: 'Anthropic API key not configured' });
        }
        
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            messages: messages.filter(m => m.role !== 'system'),
            system: messages.find(m => m.role === 'system')?.content || '',
            max_tokens
          })
        });
        
        const data = await anthropicResponse.json();
        console.log('Anthropic API response:', JSON.stringify(data).substring(0, 500));
        content = data.content?.[0]?.text || '';
        usage = data.usage;
        break;
      }
      
      case 'google': {
        if (!process.env.GOOGLE_API_KEY) {
          return res.status(500).json({ error: 'Google API key not configured' });
        }
        
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: max_tokens, temperature }
          })
        });
        
        const data = await googleResponse.json();
        console.log('Google API response:', JSON.stringify(data).substring(0, 500));
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        usage = data.usageMetadata;
        break;
      }
      
      case 'groq': {
        if (!process.env.GROQ_API_KEY) {
          return res.status(500).json({ error: 'Groq API key not configured' });
        }
        
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        });
        
        const data = await groqResponse.json();
        content = data.choices?.[0]?.message?.content || '';
        usage = data.usage;
        break;
      }
      
      case 'xai': {
        if (!process.env.XAI_API_KEY) {
          return res.status(500).json({ error: 'xAI API key not configured' });
        }
        
        const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.XAI_API_KEY}`
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        });
        
        const data = await xaiResponse.json();
        console.log('XAI API response:', JSON.stringify(data).substring(0, 500));
        content = data.choices?.[0]?.message?.content || '';
        usage = data.usage;
        break;
      }
      
      // Perplexity case removed - models not working
      
      case 'deepseek': {
        if (!process.env.DEEPSEEK_API_KEY) {
          return res.status(500).json({ error: 'Deepseek API key not configured' });
        }
        
        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        });
        
        const data = await deepseekResponse.json();
        content = data.choices?.[0]?.message?.content || '';
        usage = data.usage;
        break;
      }
      
      default:
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    res.json({
      choices: [{ message: { content } }],
      usage
    });
    
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});

// Note: Specific routes must come before parameterized routes
app.get('/api/models', authenticateToken, (req, res) => {
  try {
    const models = db.prepare(`
      SELECT m.*, COUNT(d.id) as document_count
      FROM custom_models m
      LEFT JOIN model_documents d ON m.id = d.model_id
      WHERE m.user_id = ?
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `).all(req.user.id);

    res.json(models);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/api/models/:id', authenticateToken, (req, res) => {
  try {
    const model = db.prepare(`
      SELECT * FROM custom_models 
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const documents = db.prepare(`
      SELECT * FROM model_documents 
      WHERE model_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ ...model, documents });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

app.post('/api/models', authenticateToken, (req, res) => {
  try {
    const { name, baseModel, systemInstructions, openingStatement } = req.body;

    if (!name || !baseModel || !systemInstructions || !openingStatement) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = db.prepare(`
      INSERT INTO custom_models (user_id, name, base_model, system_instructions, opening_statement)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, name, baseModel, systemInstructions, openingStatement);

    const model = db.prepare('SELECT * FROM custom_models WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(model);
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

app.put('/api/models/:id', authenticateToken, (req, res) => {
  try {
    const { name, baseModel, systemInstructions, openingStatement } = req.body;

    // Check ownership
    const existing = db.prepare('SELECT id FROM custom_models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!existing) {
      return res.status(404).json({ error: 'Model not found' });
    }

    db.prepare(`
      UPDATE custom_models 
      SET name = ?, base_model = ?, system_instructions = ?, opening_statement = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(name, baseModel, systemInstructions, openingStatement, req.params.id, req.user.id);

    const model = db.prepare('SELECT * FROM custom_models WHERE id = ?').get(req.params.id);
    res.json(model);
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

// Share a model endpoint
app.post('/api/models/:id/share', authenticateToken, (req, res) => {
  try {
    const model = db.prepare('SELECT * FROM custom_models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Generate share token if not exists, otherwise reuse existing token
    let shareToken = model.share_token;
    if (!shareToken) {
      shareToken = generateShareToken();
      db.prepare('UPDATE custom_models SET share_token = ?, is_public = 1 WHERE id = ?').run(
        shareToken,
        req.params.id
      );
    } else {
      // Just set is_public to 1 if token already exists
      db.prepare('UPDATE custom_models SET is_public = 1 WHERE id = ?').run(req.params.id);
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
      'UPDATE custom_models SET is_public = 0 WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

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
      FROM custom_models m
      JOIN users u ON m.user_id = u.id
      WHERE m.share_token = ? AND m.is_public = 1
    `).get(shareToken);

    if (!originalModel) {
      return res.status(404).json({ error: 'Invalid share token or model not found' });
    }

    // Check if already imported by looking for existing model with same original_model_id
    const existingImported = db.prepare(`
      SELECT id FROM custom_models 
      WHERE user_id = ? AND original_model_id = ?
    `).get(req.user.id, originalModel.id);

    if (existingImported) {
      return res.status(400).json({ error: 'Model already imported' });
    }

    // Create a new custom model for the user (imported copy)
    const importedModelResult = db.prepare(`
      INSERT INTO custom_models (
        user_id, name, base_model, system_instructions, opening_statement, 
        is_imported, original_model_id, original_owner_name, original_owner_email,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      req.user.id,
      originalModel.name,
      originalModel.base_model,
      originalModel.system_instructions,
      originalModel.opening_statement,
      originalModel.id,
      originalModel.owner_name,
      originalModel.owner_email
    );

    // Copy documents from original model
    const originalDocuments = db.prepare(`
      SELECT * FROM model_documents WHERE model_id = ?
    `).all(originalModel.id);

    for (const doc of originalDocuments) {
      db.prepare(`
        INSERT INTO model_documents (
          model_id, filename, original_name, content, file_path, file_type, file_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        importedModelResult.lastInsertRowid,
        doc.filename,
        doc.original_name,
        doc.content,
        doc.file_path, // Note: This references the original file
        doc.file_type,
        doc.file_size
      );
    }

    // Record the import in the tracking table
    db.prepare(`
      INSERT INTO imported_models (user_id, original_model_id, share_token)
      VALUES (?, ?, ?)
    `).run(req.user.id, originalModel.id, shareToken);

    // Increment share count
    db.prepare('UPDATE custom_models SET share_count = share_count + 1 WHERE id = ?').run(originalModel.id);

    // Get the newly created model with document count
    const importedModel = db.prepare(`
      SELECT m.*, COUNT(d.id) as document_count
      FROM custom_models m
      LEFT JOIN model_documents d ON m.id = d.model_id
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
      SELECT 
        m.*,
        u.name as owner_name,
        u.email as owner_email,
        im.imported_at,
        (SELECT COUNT(*) FROM model_documents WHERE model_id = m.id) as document_count
      FROM imported_models im
      JOIN custom_models m ON im.original_model_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE im.user_id = ?
      ORDER BY im.imported_at DESC
    `).all(req.user.id);

    res.json(importedModels);
  } catch (error) {
    console.error('Get imported models error:', error);
    res.status(500).json({ error: 'Failed to fetch imported models' });
  }
});

// Get all public community models
app.get('/api/models/community', authenticateToken, (req, res) => {
  try {
    const communityModels = db.prepare(`
      SELECT 
        m.*,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM model_documents WHERE model_id = m.id) as document_count
      FROM custom_models m
      JOIN users u ON m.user_id = u.id
      WHERE m.is_public = 1 AND m.share_token IS NOT NULL
      ORDER BY m.share_count DESC, m.created_at DESC
    `).all();

    res.json(communityModels);
  } catch (error) {
    console.error('Get community models error:', error);
    res.status(500).json({ error: 'Failed to fetch community models' });
  }
});

app.delete('/api/models/:id', authenticateToken, (req, res) => {
  try {
    // Check ownership and delete associated documents
    const model = db.prepare('SELECT id FROM custom_models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Delete associated document files
    const documents = db.prepare('SELECT file_path FROM model_documents WHERE model_id = ?').all(req.params.id);
    documents.forEach(doc => {
      if (doc.file_path && fs.existsSync(join(__dirname, doc.file_path))) {
        fs.unlinkSync(join(__dirname, doc.file_path));
      }
    });

    // Delete model (documents will be cascade deleted)
    db.prepare('DELETE FROM custom_models WHERE id = ?').run(req.params.id);

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Document upload
app.post('/api/models/:id/documents', authenticateToken, upload.array('documents', 3), async (req, res) => {
  try {
    // Check model ownership
    const model = db.prepare('SELECT id FROM custom_models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Check existing document count
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM model_documents WHERE model_id = ?').get(req.params.id).count;
    const newCount = existingCount + req.files.length;

    if (newCount > 3) {
      // Clean up uploaded files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(400).json({ error: `Cannot upload ${req.files.length} files. Maximum 3 documents allowed. Currently have ${existingCount} documents.` });
    }

    const documents = [];
    for (const file of req.files) {
      try {
        // Extract text content from the document
        const content = await extractTextFromDocument(file.path, file.mimetype, file.originalname);

        const result = db.prepare(`
          INSERT INTO model_documents (model_id, filename, original_name, content, file_path, file_type, file_size)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.params.id,
          file.filename,
          file.originalname,
          content,
          `uploads/${file.filename}`,
          file.mimetype,
          file.size
        );

        documents.push({
          id: result.lastInsertRowid,
          filename: file.filename,
          original_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          content_preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
        });
      } catch (extractError) {
        console.error('Error processing file:', file.originalname, extractError);
        // Clean up the file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({ error: `Failed to process ${file.originalname}. Please ensure it's a valid document.` });
      }
    }

    res.status(201).json(documents);
  } catch (error) {
    console.error('Upload documents error:', error);
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

app.delete('/api/models/:modelId/documents/:docId', authenticateToken, (req, res) => {
  try {
    // Check ownership
    const doc = db.prepare(`
      SELECT d.*, m.user_id 
      FROM model_documents d
      JOIN custom_models m ON d.model_id = m.id
      WHERE d.id = ? AND m.id = ? AND m.user_id = ?
    `).get(req.params.docId, req.params.modelId, req.user.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file
    if (doc.file_path && fs.existsSync(join(__dirname, doc.file_path))) {
      fs.unlinkSync(join(__dirname, doc.file_path));
    }

    // Delete database record
    db.prepare('DELETE FROM model_documents WHERE id = ?').run(req.params.docId);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Get documents content for a model (for AI conversations)
app.get('/api/models/:id/documents/content', authenticateToken, (req, res) => {
  try {
    // Check model ownership
    const model = db.prepare('SELECT id FROM custom_models WHERE id = ? AND user_id = ?').get(
      req.params.id,
      req.user.id
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const documents = db.prepare(`
      SELECT original_name, content, file_type
      FROM model_documents 
      WHERE model_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id);

    res.json(documents);
  } catch (error) {
    console.error('Get documents content error:', error);
    res.status(500).json({ error: 'Failed to fetch documents content' });
  }
});

// Usage tracking endpoints
app.post('/api/usage/track', authenticateToken, (req, res) => {
  try {
    const { 
      modelId, 
      modelName, 
      promptTokens, 
      completionTokens, 
      totalTokens, 
      conversationId 
    } = req.body;

    if (!modelId || !modelName || totalTokens === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate cost based on model
    let costPer1kTokens = 0.01; // Default
    if (modelId.includes('gpt-4o-mini')) {
      costPer1kTokens = 0.00015;
    } else if (modelId.includes('gpt-4o')) {
      costPer1kTokens = 0.005;
    } else if (modelId.includes('gpt-4-turbo')) {
      costPer1kTokens = 0.01;
    } else if (modelId.includes('gpt-4')) {
      costPer1kTokens = 0.03;
    }

    const cost = (totalTokens / 1000) * costPer1kTokens;

    // Store usage log
    const result = db.prepare(`
      INSERT INTO usage_logs (
        user_id, model_id, model_name, 
        prompt_tokens, completion_tokens, total_tokens, 
        cost, conversation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      modelId,
      modelName,
      promptTokens || 0,
      completionTokens || 0,
      totalTokens,
      cost,
      conversationId || null
    );

    res.json({ 
      success: true, 
      usageId: result.lastInsertRowid,
      cost: cost 
    });
  } catch (error) {
    console.error('Track usage error:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Get user usage statistics
app.get('/api/usage/stats', authenticateToken, (req, res) => {
  try {
    // Get total usage
    const totalUsage = db.prepare(`
      SELECT 
        SUM(prompt_tokens) as total_input_tokens,
        SUM(completion_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as total_cost,
        COUNT(DISTINCT conversation_id) as total_conversations
      FROM usage_logs
      WHERE user_id = ?
    `).get(req.user.id);

    // Get model breakdown
    const modelUsage = db.prepare(`
      SELECT 
        model_name as model,
        SUM(total_tokens) as tokens,
        COUNT(DISTINCT conversation_id) as conversations,
        SUM(cost) as cost
      FROM usage_logs
      WHERE user_id = ?
      GROUP BY model_name
      ORDER BY tokens DESC
    `).all(req.user.id);

    // Get daily usage for last 30 days
    const dailyUsage = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(total_tokens) as tokens,
        SUM(cost) as cost
      FROM usage_logs
      WHERE user_id = ? 
        AND created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all(req.user.id);

    res.json({
      totalTokens: totalUsage.total_tokens || 0,
      inputTokens: totalUsage.total_input_tokens || 0,
      outputTokens: totalUsage.total_output_tokens || 0,
      totalConversations: totalUsage.total_conversations || 0,
      totalCost: totalUsage.total_cost || 0,
      modelUsage: modelUsage || [],
      dailyUsage: dailyUsage || []
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Get usage details with pagination
app.get('/api/usage/details', authenticateToken, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const usageLogs = db.prepare(`
      SELECT 
        model_name,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost,
        conversation_id,
        created_at
      FROM usage_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM usage_logs
      WHERE user_id = ?
    `).get(req.user.id);

    res.json({
      logs: usageLogs,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    console.error('Get usage details error:', error);
    res.status(500).json({ error: 'Failed to fetch usage details' });
  }
});

// Conversation endpoints
app.post('/api/conversations', authenticateToken, (req, res) => {
  try {
    const { id, title, modelA, modelB } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const result = db.prepare(`
      INSERT INTO conversations (id, user_id, title, model_a, model_b)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        model_a = excluded.model_a,
        model_b = excluded.model_b,
        updated_at = CURRENT_TIMESTAMP
    `).run(id, req.user.id, title || 'New Conversation', modelA || null, modelB || null);

    res.json({ success: true, conversationId: id });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.put('/api/conversations/:id/increment', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE conversations 
      SET message_count = message_count + 1, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Increment message count error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Create HTTP server
const server = createServer(app);

// WebSocket server for live conversations
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Store active live sessions and multiplayer rooms
const liveSessions = new Map();
const multiplayerRooms = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  let sessionInfo = null;
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        // New Multiplayer Session Handlers
        case 'create_multiplayer_session':
          const room = {
            pin: data.pin,
            hostId: data.hostId,
            hostName: data.hostName,
            host: ws,
            participants: new Map(),
            status: 'waiting',
            settings: data.settings,
            createdAt: new Date()
          };
          
          // Add host as first participant
          room.participants.set(data.hostId, {
            id: data.hostId,
            name: data.hostName,
            role: 'host',
            ws: ws,
            isReady: true,
            joinedAt: new Date(),
            connectionStatus: 'connected'
          });
          
          multiplayerRooms.set(data.pin, room);
          currentRoom = data.pin;
          
          // Save session to database
          try {
            db.prepare(`
              INSERT OR REPLACE INTO multiplayer_sessions (pin, host_id, status)
              VALUES (?, ?, ?)
            `).run(data.pin, data.hostId, 'waiting');
          } catch (err) {
            console.error('Error saving session to database:', err);
          }
          
          ws.send(JSON.stringify({
            type: 'session_created',
            pin: data.pin,
            participants: Array.from(room.participants.values()).map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              isReady: p.isReady,
              joinedAt: p.joinedAt,
              connectionStatus: p.connectionStatus
            }))
          }));
          
          console.log(`Multiplayer session created with PIN: ${data.pin}`);
          break;
          
        case 'join_multiplayer_session':
          const existingRoom = multiplayerRooms.get(data.pin);
          
          if (!existingRoom) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session not found. Please check the PIN and try again.'
            }));
            break;
          }
          
          if (existingRoom.participants.size >= existingRoom.settings.maxParticipants) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session is full'
            }));
            break;
          }
          
          // Add participant
          const participant = {
            id: data.participantId,
            name: data.participantName,
            role: data.role || 'participant',
            ws: ws,
            isReady: false,
            joinedAt: new Date(),
            connectionStatus: 'connected'
          };
          
          existingRoom.participants.set(data.participantId, participant);
          currentRoom = data.pin;
          
          // Send session info to joiner
          ws.send(JSON.stringify({
            type: 'session_joined',
            pin: data.pin,
            hostName: existingRoom.hostName,
            participants: Array.from(existingRoom.participants.values()).map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              isReady: p.isReady,
              joinedAt: p.joinedAt,
              connectionStatus: p.connectionStatus
            })),
            settings: existingRoom.settings
          }));
          
          // Notify all participants about new joiner
          existingRoom.participants.forEach((p) => {
            if (p.ws !== ws && p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'participant_joined',
                participant: {
                  id: participant.id,
                  name: participant.name,
                  role: participant.role,
                  isReady: participant.isReady,
                  joinedAt: participant.joinedAt,
                  connectionStatus: participant.connectionStatus
                }
              }));
            }
          });
          
          console.log(`${data.participantName} joined session ${data.pin}`);
          break;
          
        case 'start_session':
          const roomToStart = multiplayerRooms.get(data.pin);
          if (roomToStart && roomToStart.host === ws) {
            roomToStart.status = 'active';
            
            // Notify all participants
            roomToStart.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'session_started',
                  pin: data.pin
                }));
              }
            });
            
            console.log(`Session ${data.pin} started`);
          }
          break;
          
        case 'start_ai_conversation':
          const aiRoom = multiplayerRooms.get(data.pin);
          if (aiRoom) {
            // Check if sender is the host by finding their participant entry
            const senderParticipant = Array.from(aiRoom.participants.values())
              .find(p => p.ws === ws);
            
            if (senderParticipant && senderParticipant.role === 'host') {
              // Mark room as starting so it won't be deleted when host disconnects
              aiRoom.status = 'starting';
              aiRoom.setupData = data.setupData;
              
              // Update database
              try {
                db.prepare(`
                  UPDATE multiplayer_sessions 
                  SET status = 'active', setup_data = ?
                  WHERE pin = ?
                `).run(JSON.stringify(data.setupData), data.pin);
              } catch (err) {
                console.error('Error updating session in database:', err);
              }
              
              // Give a small delay to ensure host disconnection is handled properly
              setTimeout(() => {
                aiRoom.status = 'active';
                
                // Notify all participants with setup data
                aiRoom.participants.forEach((p) => {
                  if (p.ws && p.ws.readyState === ws.OPEN) {
                    p.ws.send(JSON.stringify({
                      type: 'session_started',
                      pin: data.pin,
                      setupData: data.setupData
                    }));
                  }
                });
                
                console.log(`AI conversation started in session ${data.pin}, notifying ${aiRoom.participants.size} participants`);
              }, 500); // Small delay to handle host transition
            } else {
              console.log('Non-host tried to start AI conversation');
            }
          } else {
            console.log(`Session ${data.pin} not found for start_ai_conversation`);
          }
          break;
          
        case 'broadcast_multiplayer_message':
          const msgRoom = multiplayerRooms.get(data.pin);
          if (msgRoom) {
            // Broadcast to all participants
            msgRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'multiplayer_message',
                  message: data.message,
                  senderId: data.senderId,
                  senderName: data.senderName
                }));
              }
            });
          }
          break;

        // Arena-specific handlers for the new MultiplayerArena page
        case 'join_arena_session':
          const arenaRoom = multiplayerRooms.get(data.pin);
          
          if (!arenaRoom) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Arena session not found'
            }));
            break;
          }
          
          // Add or update participant in arena
          const arenaParticipant = {
            id: data.participantId,
            name: data.participantName,
            role: data.participantId === arenaRoom.hostId ? 'host' : 'participant',
            ws: ws,
            isActive: true,
            lastActivity: new Date()
          };
          
          arenaRoom.participants.set(data.participantId, arenaParticipant);
          currentRoom = data.pin;
          
          // Send current participants list to the joining user
          const participantsList = Array.from(arenaRoom.participants.values()).map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            isActive: p.isActive,
            lastActivity: p.lastActivity
          }));
          
          ws.send(JSON.stringify({
            type: 'arena_participants_list',
            participants: participantsList
          }));
          
          // Notify all OTHER participants about the new participant (don't send to self)
          arenaRoom.participants.forEach((p) => {
            if (p.ws !== ws && p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'arena_participant_joined',
                participant: {
                  id: arenaParticipant.id,
                  name: arenaParticipant.name,
                  role: arenaParticipant.role,
                  isActive: arenaParticipant.isActive,
                  lastActivity: arenaParticipant.lastActivity
                }
              }));
            }
          });
          
          console.log(`${data.participantName} joined arena ${data.pin}`);
          break;

        case 'arena_chat_message':
          const chatRoom = multiplayerRooms.get(data.pin);
          if (chatRoom) {
            // Broadcast chat message to all participants
            chatRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'arena_chat_message',
                  content: data.content,
                  authorId: data.authorId,
                  authorName: data.authorName,
                  timestamp: new Date()
                }));
              }
            });
          }
          break;

        case 'arena_intervention':
          const interventionRoom = multiplayerRooms.get(data.pin);
          if (interventionRoom) {
            // Check if sender is host by participant role
            const interventionSender = Array.from(interventionRoom.participants.values())
              .find(p => p.ws === ws);
            
            if (interventionSender && interventionSender.role === 'host') {
              // Broadcast intervention to all participants
              interventionRoom.participants.forEach((p) => {
                if (p.ws.readyState === ws.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'arena_intervention',
                    content: data.content,
                    authorName: data.authorName,
                    timestamp: new Date()
                  }));
                }
              });
            }
          }
          break;

        case 'arena_control':
          const controlRoom = multiplayerRooms.get(data.pin);
          if (controlRoom) {
            // Check if sender is host by participant role
            const controlSender = Array.from(controlRoom.participants.values())
              .find(p => p.ws === ws);
            
            if (controlSender && controlSender.role === 'host') {
              let newStatus = controlRoom.status;
              
              switch (data.action) {
                case 'pause':
                  newStatus = 'paused';
                  break;
                case 'resume':
                  newStatus = 'active';
                  break;
                case 'end':
                  newStatus = 'ended';
                  break;
              }
              
              controlRoom.status = newStatus;
              
              // Broadcast status change to all participants
              controlRoom.participants.forEach((p) => {
                if (p.ws.readyState === ws.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'arena_status_change',
                    status: newStatus
                  }));
                }
              });
              
              if (newStatus === 'ended') {
                // Clean up the room
                multiplayerRooms.delete(data.pin);
              }
            }
          }
          break;

        case 'rejoin_multiplayer_session':
          const rejoinRoom = multiplayerRooms.get(data.pin);
          if (rejoinRoom) {
            // Update or add participant
            const participant = rejoinRoom.participants.get(data.participantId);
            if (participant) {
              // Update existing participant's WebSocket
              participant.ws = ws;
              participant.connectionStatus = 'connected';
              participant.lastActivity = new Date();
            } else {
              // Add new participant
              rejoinRoom.participants.set(data.participantId, {
                id: data.participantId,
                name: data.participantName,
                role: data.participantId === rejoinRoom.hostId ? 'host' : 'participant',
                ws: ws,
                isReady: false,
                joinedAt: new Date(),
                connectionStatus: 'connected'
              });
            }
            currentRoom = data.pin;
            
            // Send current session state to rejoining participant
            ws.send(JSON.stringify({
              type: 'session_rejoined',
              pin: data.pin,
              hostName: rejoinRoom.hostName,
              status: rejoinRoom.status,
              participants: Array.from(rejoinRoom.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                isReady: p.isReady || true,
                joinedAt: p.joinedAt,
                connectionStatus: p.connectionStatus
              })),
              settings: rejoinRoom.settings,
              setupData: rejoinRoom.setupData
            }));
            
            console.log(`${data.participantName} rejoined session ${data.pin}`);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session not found'
            }));
          }
          break;

        case 'arena_conversation_started':
          const startRoom = multiplayerRooms.get(data.pin);
          if (startRoom) {
            // Check if the sender is the host by ID instead of WebSocket reference
            const senderParticipant = Array.from(startRoom.participants.values())
              .find(p => p.ws === ws);
            
            if (senderParticipant && senderParticipant.role === 'host') {
              startRoom.status = 'active';
              // Update host WebSocket reference
              startRoom.host = ws;
              
              // Save first message to database
              if (data.message) {
                try {
                  db.prepare(`
                    INSERT INTO multiplayer_messages (session_pin, message_type, sender, content, metadata)
                    VALUES (?, ?, ?, ?, ?)
                  `).run(
                    data.pin,
                    'ai',
                    data.message.sender,
                    data.message.content,
                    JSON.stringify({
                      exchangeCount: 1,
                      nextTurn: 'model-b',
                      waitingForIntervention: false
                    })
                  );
                  console.log('Saved first message to database for session', data.pin);
                } catch (err) {
                  console.error('Error saving first message to database:', err);
                }
              }
              
              // Broadcast conversation start to all participants
              startRoom.participants.forEach((p) => {
                if (p.ws.readyState === ws.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'arena_message_update',
                    message: data.message,
                    nextTurn: 'model-b',
                    exchangeCount: 1,
                    waitingForIntervention: false
                  }));
                }
              });
              
              console.log('Arena conversation started, broadcasting to participants');
            }
          }
          break;
        
        case 'arena_message_update':
          const updateRoom = multiplayerRooms.get(data.pin);
          if (updateRoom) {
            // Save message to database
            try {
              db.prepare(`
                INSERT INTO multiplayer_messages (session_pin, message_type, sender, content, metadata)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                data.pin,
                'ai',
                data.message.sender,
                data.message.content,
                JSON.stringify({
                  exchangeCount: data.exchangeCount,
                  nextTurn: data.nextTurn,
                  waitingForIntervention: data.waitingForIntervention
                })
              );
            } catch (err) {
              console.error('Error saving message to database:', err);
            }
            
            // Broadcast AI message to all participants
            updateRoom.participants.forEach((p) => {
              // Send to all participants including the sender
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'arena_message_update',
                  message: data.message,
                  nextTurn: data.nextTurn,
                  exchangeCount: data.exchangeCount,
                  waitingForIntervention: data.waitingForIntervention
                }));
              }
            });
            console.log(`Broadcasting AI message in arena ${data.pin}`);
          }
          break;
        
        case 'arena_intervention':
          const arenaInterventionRoom = multiplayerRooms.get(data.pin);
          if (arenaInterventionRoom) {
            // Broadcast intervention to all participants
            arenaInterventionRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'arena_intervention',
                  content: data.content,
                  authorName: data.authorName
                }));
              }
            });
            console.log(`Intervention sent in arena ${data.pin}`);
          }
          break;
        
        case 'arena_chat_message':
          const arenaChatRoom = multiplayerRooms.get(data.pin);
          if (arenaChatRoom) {
            // Broadcast chat message to all participants
            arenaChatRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'arena_chat_message',
                  content: data.content,
                  authorId: data.authorId,
                  authorName: data.authorName
                }));
              }
            });
            console.log(`Chat message sent in arena ${data.pin}`);
          }
          break;
        
        case 'join_viewer_session':
          const viewerRoom = multiplayerRooms.get(data.pin);
          if (viewerRoom) {
            // Add or update viewer participant
            const viewerParticipant = viewerRoom.participants.get(data.participantId);
            if (viewerParticipant) {
              viewerParticipant.ws = ws;
              viewerParticipant.connectionStatus = 'connected';
            } else {
              viewerRoom.participants.set(data.participantId, {
                id: data.participantId,
                name: data.participantName,
                role: 'viewer',
                ws: ws,
                isReady: true,
                joinedAt: new Date(),
                connectionStatus: 'connected'
              });
            }
            
            // Get existing messages from database
            let existingMessages = [];
            try {
              const messages = db.prepare(`
                SELECT * FROM multiplayer_messages 
                WHERE session_pin = ? 
                ORDER BY created_at ASC
              `).all(data.pin);
              
              existingMessages = messages.map(msg => ({
                type: msg.message_type,
                content: msg.content,
                sender: msg.sender,
                metadata: JSON.parse(msg.metadata || '{}'),
                timestamp: msg.created_at
              }));
            } catch (err) {
              console.error('Error fetching messages from database:', err);
            }
            
            // Send current session state and messages to viewer
            ws.send(JSON.stringify({
              type: 'viewer_joined',
              status: viewerRoom.status,
              participantCount: viewerRoom.participants.size,
              messages: existingMessages,
              exchangeCount: existingMessages.length
            }));
            
            // Notify all participants of new viewer count
            viewerRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'participant_count_update',
                  count: viewerRoom.participants.size
                }));
              }
            });
            
            console.log(`Viewer ${data.participantName} joined session ${data.pin}, sent ${existingMessages.length} existing messages`);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session not found'
            }));
          }
          break;
        
        case 'arena_status_change':
          const statusRoom = multiplayerRooms.get(data.pin);
          if (statusRoom) {
            // Update room status
            statusRoom.status = data.status;
            
            // Broadcast status change to all participants
            statusRoom.participants.forEach((p) => {
              if (p.ws.readyState === ws.OPEN) {
                p.ws.send(JSON.stringify({
                  type: 'arena_status_change',
                  status: data.status
                }));
              }
            });
            console.log(`Arena status changed to ${data.status} for session ${data.pin}`);
          }
          break;

        // Original live session handlers (kept for compatibility)
        case 'start_live_session':
          // Create a new live session
          const shareCode = data.predefinedToken || generateShareToken();
          sessionInfo = {
            conversationId: data.conversationId,
            hostUserId: data.userId,
            shareCode,
            viewers: new Set(),
            host: ws
          };
          liveSessions.set(shareCode, sessionInfo);

          // Store in database
          try {
            db.prepare(`
              INSERT INTO live_sessions (conversation_id, host_user_id, share_code)
              VALUES (?, ?, ?)
            `).run(data.conversationId, data.userId, shareCode);
          } catch (err) {
            console.log('Live session might already exist, updating...');
            db.prepare(`
              UPDATE live_sessions 
              SET is_active = 1, viewer_count = 0
              WHERE share_code = ?
            `).run(shareCode);
          }

          // Send share code back to host
          ws.send(JSON.stringify({
            type: 'session_started',
            shareCode
          }));
          
          console.log(`Live session started with code: ${shareCode}`);
          break;

        case 'join_live_session':
          // Join an existing live session as viewer
          console.log(`Viewer attempting to join with code: ${data.shareCode}`);
          const session = liveSessions.get(data.shareCode);
          
          if (session) {
            session.viewers.add(ws);
            sessionInfo = { ...session, role: 'viewer', shareCode: data.shareCode };
            
            console.log(`Viewer joined session ${data.shareCode}. Total viewers: ${session.viewers.size}`);

            // Update viewer count
            try {
              db.prepare(`
                UPDATE live_sessions 
                SET viewer_count = viewer_count + 1 
                WHERE share_code = ?
              `).run(data.shareCode);
            } catch (err) {
              console.error('Error updating viewer count:', err);
            }

            // Send current conversation state to new viewer
            ws.send(JSON.stringify({
              type: 'session_joined',
              conversationId: session.conversationId,
              viewerCount: session.viewers.size
            }));

            // Notify host of new viewer
            if (session.host && session.host.readyState === ws.OPEN) {
              session.host.send(JSON.stringify({
                type: 'viewer_joined',
                viewerCount: session.viewers.size
              }));
            }
          } else {
            console.log(`Session not found for code: ${data.shareCode}`);
            console.log('Active sessions:', Array.from(liveSessions.keys()));
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid or expired share code'
            }));
          }
          break;

        case 'broadcast_message':
          // Host broadcasts a new message to all viewers
          if (sessionInfo && sessionInfo.host === ws) {
            const broadcastData = JSON.stringify({
              type: 'new_message',
              message: data.message
            });

            console.log(`Broadcasting message to ${sessionInfo.viewers.size} viewers`);
            
            // Send to all viewers
            sessionInfo.viewers.forEach(viewer => {
              if (viewer.readyState === ws.OPEN) {
                viewer.send(broadcastData);
                console.log('Message sent to viewer');
              }
            });
          } else {
            console.log('Broadcast attempt failed - not the host or no session');
          }
          break;

        case 'end_live_session':
          // Host ends the live session
          if (sessionInfo && sessionInfo.host === ws) {
            // Notify all viewers
            sessionInfo.viewers.forEach(viewer => {
              viewer.send(JSON.stringify({
                type: 'session_ended'
              }));
              viewer.close();
            });

            // Update database
            db.prepare(`
              UPDATE live_sessions 
              SET is_active = 0, ended_at = CURRENT_TIMESTAMP 
              WHERE share_code = ?
            `).run(sessionInfo.shareCode);

            // Remove from active sessions
            liveSessions.delete(sessionInfo.shareCode);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    // Clean up multiplayer rooms
    if (currentRoom) {
      const room = multiplayerRooms.get(currentRoom);
      if (room) {
        // Find and remove the disconnected participant
        let disconnectedParticipant = null;
        room.participants.forEach((p, id) => {
          if (p.ws === ws) {
            disconnectedParticipant = p;
            room.participants.delete(id);
          }
        });
        
        if (disconnectedParticipant) {
          // Notify remaining participants
          room.participants.forEach((p) => {
            if (p.ws.readyState === ws.OPEN) {
              p.ws.send(JSON.stringify({
                type: 'participant_left',
                participantId: disconnectedParticipant.id,
                participantName: disconnectedParticipant.name
              }));
            }
          });
          
          // If host left, check if they're transitioning to arena or actually disconnecting
          if (disconnectedParticipant.role === 'host') {
            // If the room is active, the host has already moved to arena - keep session alive
            if (room.status === 'active' || room.status === 'starting') {
              console.log(`Host transitioning to arena for session ${currentRoom}, keeping session alive`);
              disconnectedParticipant.connectionStatus = 'transitioning';
            } else {
              // Host left before starting - end session
              room.participants.forEach((p) => {
                if (p.ws.readyState === ws.OPEN) {
                  p.ws.send(JSON.stringify({
                    type: 'session_ended',
                    reason: 'Host disconnected'
                  }));
                  p.ws.close();
                }
              });
              multiplayerRooms.delete(currentRoom);
              console.log(`Multiplayer session ${currentRoom} ended - host disconnected before starting`);
            }
          } else {
            console.log(`${disconnectedParticipant.name} left session ${currentRoom}`);
          }
        }
        
        // Clean up empty rooms
        if (room.participants.size === 0) {
          multiplayerRooms.delete(currentRoom);
        }
      }
    }
    
    // Clean up original live sessions (kept for compatibility)
    if (sessionInfo) {
      if (sessionInfo.host === ws) {
        // Host disconnected - end session
        sessionInfo.viewers.forEach(viewer => {
          viewer.send(JSON.stringify({
            type: 'session_ended',
            reason: 'Host disconnected'
          }));
          viewer.close();
        });

        db.prepare(`
          UPDATE live_sessions 
          SET is_active = 0, ended_at = CURRENT_TIMESTAMP 
          WHERE share_code = ?
        `).run(sessionInfo.shareCode);

        liveSessions.delete(sessionInfo.shareCode);
      } else if (sessionInfo.role === 'viewer' && sessionInfo.shareCode) {
        // Viewer disconnected
        const session = liveSessions.get(sessionInfo.shareCode);
        if (session) {
          session.viewers.delete(ws);

          db.prepare(`
            UPDATE live_sessions 
            SET viewer_count = CASE WHEN viewer_count > 0 THEN viewer_count - 1 ELSE 0 END 
            WHERE share_code = ?
          `).run(sessionInfo.shareCode);

          // Notify host
          if (session.host) {
            session.host.send(JSON.stringify({
              type: 'viewer_left',
              viewerCount: session.viewers.size
            }));
          }
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Live session API endpoints
app.post('/api/live/create', authenticateToken, (req, res) => {
  try {
    const { conversationId, shareCode } = req.body;
    
    if (!conversationId || !shareCode) {
      return res.status(400).json({ error: 'Conversation ID and share code required' });
    }

    // Create or update live session
    try {
      db.prepare(`
        INSERT INTO live_sessions (conversation_id, host_user_id, share_code)
        VALUES (?, ?, ?)
      `).run(conversationId, req.user.id, shareCode);
    } catch (err) {
      // Session might already exist, update it
      db.prepare(`
        UPDATE live_sessions 
        SET is_active = 1, conversation_id = ?
        WHERE share_code = ?
      `).run(conversationId, shareCode);
    }
    
    console.log(`Live session created: ${shareCode} for conversation: ${conversationId}`);
    res.json({ success: true, shareCode });
  } catch (error) {
    console.error('Create live session error:', error);
    res.status(500).json({ error: 'Failed to create live session' });
  }
});

app.post('/api/live/message', authenticateToken, (req, res) => {
  try {
    const { shareCode, message } = req.body;
    
    if (!shareCode || !message) {
      return res.status(400).json({ error: 'Share code and message required' });
    }

    // Verify session exists and user is host
    const session = db.prepare(`
      SELECT * FROM live_sessions 
      WHERE share_code = ? AND host_user_id = ? AND is_active = 1
    `).get(shareCode, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'Live session not found or not authorized' });
    }

    // Add message to live messages
    db.prepare(`
      INSERT INTO live_messages (share_code, message_id, sender, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(shareCode, message.id, message.sender, message.content, message.timestamp);

    console.log(`Message added to live session ${shareCode}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Add live message error:', error);
    res.status(500).json({ error: 'Failed to add message to live session' });
  }
});

app.get('/api/live/:shareCode/messages', (req, res) => {
  try {
    const { shareCode } = req.params;
    const { since } = req.query;
    
    // Verify session exists and is active
    const session = db.prepare(`
      SELECT * FROM live_sessions 
      WHERE share_code = ? AND is_active = 1
    `).get(shareCode);

    if (!session) {
      return res.status(404).json({ error: 'Live session not found or inactive' });
    }

    // Get messages since timestamp (or all if no since parameter)
    let query = `
      SELECT message_id, sender, content, timestamp 
      FROM live_messages 
      WHERE share_code = ?
    `;
    const params = [shareCode];
    
    if (since) {
      query += ` AND timestamp > ?`;
      params.push(since);
    }
    
    query += ` ORDER BY timestamp ASC`;
    
    const messages = db.prepare(query).all(...params);
    
    res.json({ 
      success: true, 
      messages: messages.map(msg => ({
        id: msg.message_id,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      })),
      sessionInfo: {
        conversationId: session.conversation_id,
        isActive: session.is_active
      }
    });
  } catch (error) {
    console.error('Get live messages error:', error);
    res.status(500).json({ error: 'Failed to get live messages' });
  }
});

// Community Posts Routes
// GET posts doesn't require authentication (public forum)
app.get('/api/community/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT 
        p.*,
        u.name as username
      FROM community_posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `).all();

    const formattedPosts = posts.map(post => ({
      ...post,
      tags: JSON.parse(post.tags || '[]'),
      timestamp: post.created_at
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Get community posts error:', error);
    res.status(500).json({ error: 'Failed to get community posts' });
  }
});

app.post('/api/community/posts', authenticateToken, (req, res) => {
  try {
    const { title, description, modelToken, tags } = req.body;
    
    if (!title || !description || !modelToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user info
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO community_posts (user_id, username, title, description, model_token, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      req.user.id,
      user.name,
      title,
      description,
      modelToken.toUpperCase(),
      JSON.stringify(tags || [])
    );

    const newPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      ...newPost,
      tags: JSON.parse(newPost.tags || '[]'),
      timestamp: newPost.created_at,
      achievements: []  // Will be calculated based on likes/views later
    });
  } catch (error) {
    console.error('Create community post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Like/Unlike a community post
app.post('/api/community/posts/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = req.params.id;
    
    // Check if post exists
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if user already liked this post
    const existingLike = db.prepare(`
      SELECT * FROM community_post_likes 
      WHERE post_id = ? AND user_id = ?
    `).get(postId, req.user.id);
    
    if (existingLike) {
      return res.status(400).json({ error: 'Already liked this post' });
    }
    
    // Add like
    db.prepare(`
      INSERT INTO community_post_likes (post_id, user_id)
      VALUES (?, ?)
    `).run(postId, req.user.id);
    
    // Update like count
    db.prepare(`
      UPDATE community_posts 
      SET likes = likes + 1 
      WHERE id = ?
    `).run(postId);
    
    // Return updated post
    const updatedPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    res.json(updatedPost);
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Unlike a community post
app.delete('/api/community/posts/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = req.params.id;
    
    // Check if like exists
    const existingLike = db.prepare(`
      SELECT * FROM community_post_likes 
      WHERE post_id = ? AND user_id = ?
    `).get(postId, req.user.id);
    
    if (!existingLike) {
      return res.status(400).json({ error: 'Not liked yet' });
    }
    
    // Remove like
    db.prepare(`
      DELETE FROM community_post_likes 
      WHERE post_id = ? AND user_id = ?
    `).run(postId, req.user.id);
    
    // Update like count
    db.prepare(`
      UPDATE community_posts 
      SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END 
      WHERE id = ?
    `).run(postId);
    
    // Return updated post
    const updatedPost = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    res.json(updatedPost);
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// Increment view count for a post
app.post('/api/community/posts/:id/view', (req, res) => {
  try {
    const postId = req.params.id;
    
    db.prepare(`
      UPDATE community_posts 
      SET views = views + 1 
      WHERE id = ?
    `).run(postId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Increment view error:', error);
    res.status(500).json({ error: 'Failed to increment view' });
  }
});

// Admin Routes (Secret - /admin4921)
const ADMIN_EMAIL = 'kapil@anrak.io';
const ADMIN_PASSWORD = 'KCRONALDO7';
const ADMIN_SECRET = JWT_SECRET + '_ADMIN_4921';

// Admin login
app.post('/api/admin4921/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { email: ADMIN_EMAIL, isAdmin: true },
    ADMIN_SECRET,
    { expiresIn: '4h' }
  );
  
  res.json({ token, email: ADMIN_EMAIL });
});

// Admin auth middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No admin token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
};

// Get all users with stats
app.get('/api/admin4921/users', authenticateAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.created_at,
        u.subscription_tier,
        u.subscription_status,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(DISTINCT cm.id) as custom_model_count,
        COALESCE(SUM(tu.tokens), 0) as total_tokens,
        COALESCE(SUM(tu.cost), 0) as total_cost
      FROM users u
      LEFT JOIN conversations c ON u.id = c.user_id
      LEFT JOIN custom_models cm ON u.id = cm.user_id
      LEFT JOIN token_usage tu ON u.id = tu.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
app.get('/api/admin4921/users/:id', authenticateAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const conversations = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId);
    const models = db.prepare('SELECT * FROM custom_models WHERE user_id = ?').all(userId);
    const usage = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(tokens) as tokens,
        SUM(cost) as cost
      FROM token_usage 
      WHERE user_id = ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all(userId);
    
    res.json({ user, conversations, models, usage });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user subscription
app.put('/api/admin4921/users/:id/subscription', authenticateAdmin, (req, res) => {
  try {
    const { subscription_tier, subscription_status } = req.body;
    
    db.prepare(`
      UPDATE users 
      SET subscription_tier = ?, subscription_status = ?
      WHERE id = ?
    `).run(subscription_tier, subscription_status, req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Delete user
app.delete('/api/admin4921/users/:id', authenticateAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    // Delete related data
    db.prepare('DELETE FROM token_usage WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM custom_models WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM community_post_likes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM community_posts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all community posts for admin
app.get('/api/admin4921/community/posts', authenticateAdmin, (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT 
        cp.id,
        cp.title,
        cp.description as content,
        cp.likes,
        cp.views,
        cp.created_at,
        cp.is_trending,
        cp.is_popular,
        cp.boost_score,
        u.name as author_name,
        u.email as author_email,
        cp.likes as like_count,
        0 as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      ORDER BY cp.created_at DESC
    `).all();
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Update post (trending, popular, boost)
app.put('/api/admin4921/community/posts/:id', authenticateAdmin, (req, res) => {
  try {
    const { is_trending, is_popular, boost_score } = req.body;
    
    db.prepare(`
      UPDATE community_posts 
      SET 
        is_trending = COALESCE(?, is_trending),
        is_popular = COALESCE(?, is_popular),
        boost_score = COALESCE(?, boost_score),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(is_trending, is_popular, boost_score, req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
app.delete('/api/admin4921/community/posts/:id', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM community_post_likes WHERE post_id = ?').run(req.params.id);
    db.prepare('DELETE FROM community_posts WHERE id = ?').run(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get system stats
app.get('/api/admin4921/stats', authenticateAdmin, (req, res) => {
  try {
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      totalConversations: db.prepare('SELECT COUNT(*) as count FROM conversations').get().count || 0,
      totalModels: db.prepare('SELECT COUNT(*) as count FROM custom_models').get().count || 0,
      totalPosts: db.prepare('SELECT COUNT(*) as count FROM community_posts').get().count,
      
      revenue: db.prepare(`
        SELECT 
          SUM(CASE WHEN subscription_tier = 'starter' THEN 19 ELSE 0 END) as starter_revenue,
          SUM(CASE WHEN subscription_tier = 'professional' THEN 49 ELSE 0 END) as professional_revenue,
          SUM(CASE WHEN subscription_tier = 'enterprise' THEN 199 ELSE 0 END) as enterprise_revenue,
          COUNT(CASE WHEN subscription_tier != 'explore' THEN 1 END) as paid_users
        FROM users
        WHERE subscription_status = 'active'
      `).get(),
      
      tokenUsage: db.prepare(`
        SELECT 
          SUM(tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(tokens) as avg_tokens_per_user
        FROM token_usage
      `).get() || { total_tokens: 0, total_cost: 0, avg_tokens_per_user: 0 },
      
      dailyStats: db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as conversations,
          COALESCE(SUM(tokens), 0) as tokens
        FROM (
          SELECT c.created_at, c.user_id, COALESCE(tu.tokens, 0) as tokens
          FROM conversations c
          LEFT JOIN token_usage tu ON c.user_id = tu.user_id 
            AND DATE(c.created_at) = DATE(tu.created_at)
          WHERE c.created_at >= datetime('now', '-30 days')
          UNION ALL
          SELECT tu.created_at, tu.user_id, tu.tokens
          FROM token_usage tu
          WHERE tu.created_at >= datetime('now', '-30 days')
        )
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Catch-all route to serve React app for client-side routing
// Must be last route
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not built. Please build the frontend first.');
    }
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});