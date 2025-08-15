// Robust Usage Tracking Service
// Tracks every token, enforces every limit, crystal clear database operations

// Note: pool will be passed as parameter to avoid circular import

// Model tier classification (server-side)
const MODEL_TIERS = {
  // Ultra Premium
  'openai/gpt-5': 'ultra_premium',
  'openai/gpt-5-chat': 'ultra_premium',
  'openai/o3-pro': 'ultra_premium',
  'openai/o3': 'ultra_premium',
  'anthropic/claude-opus-4.1': 'ultra_premium',
  'anthropic/claude-opus-4': 'ultra_premium',
  'x-ai/grok-4': 'ultra_premium',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'ultra_premium',

  // Premium
  'openai/gpt-4o': 'premium',
  'openai/gpt-4.1': 'premium',
  'openai/o1-pro': 'premium',
  'openai/o1': 'premium',
  'anthropic/claude-3.5-sonnet': 'premium',
  'anthropic/claude-3.7-sonnet': 'premium',
  'anthropic/claude-3-opus': 'premium',
  'google/gemini-2.5-pro': 'premium',
  'google/gemini-2.5-flash': 'premium',
  'x-ai/grok-3': 'premium',
  'x-ai/grok-3-mini': 'premium',
  'x-ai/grok-2-1212': 'premium',
  'deepseek/deepseek-r1': 'premium',
  'deepseek/deepseek-chat': 'premium'
};

// UNIVERSAL SUBSCRIPTION PLAN LIMITS - ALL PLANS HAVE SAME TIER LIMITS
const PLAN_LIMITS = {
  explore: {
    ultra_premium: 20000,  // 🔴 Ultra Premium: 20,000 tokens/day
    premium: 50000,        // 🟡 Premium: 50,000 tokens/day  
    standard: -1,          // 🟢 Standard: Unlimited
    free: -1               // ⚪ Free: Unlimited
  },
  starter: {
    ultra_premium: 20000,  // 🔴 Ultra Premium: 20,000 tokens/day
    premium: 50000,        // 🟡 Premium: 50,000 tokens/day
    standard: -1,          // 🟢 Standard: Unlimited
    free: -1               // ⚪ Free: Unlimited
  },
  professional: {
    ultra_premium: 20000,  // 🔴 Ultra Premium: 20,000 tokens/day
    premium: 50000,        // 🟡 Premium: 50,000 tokens/day
    standard: -1,          // 🟢 Standard: Unlimited
    free: -1               // ⚪ Free: Unlimited
  },
  enterprise: {
    ultra_premium: 20000,  // 🔴 Ultra Premium: 20,000 tokens/day
    premium: 50000,        // 🟡 Premium: 50,000 tokens/day
    standard: -1,          // 🟢 Standard: Unlimited
    free: -1               // ⚪ Free: Unlimited
  }
};

// Get model tier from model ID
export const getModelTier = (modelId) => {
  if (MODEL_TIERS[modelId]) {
    return MODEL_TIERS[modelId];
  }

  const id = modelId.toLowerCase();
  
  // Ultra premium patterns
  if (id.includes('gpt-5') || id.includes('o3-pro') || id.includes('claude-opus-4') || id.includes('grok-4')) {
    return 'ultra_premium';
  }
  
  // Premium patterns  
  if (id.includes('gpt-4o') || id.includes('claude-3.5') || id.includes('gemini-2.5') || 
      id.includes('grok-3') || id.includes('deepseek-r1') || id.includes('o1-pro')) {
    return 'premium';
  }
  
  // Free patterns
  if (id.includes(':free') || id.includes('free')) {
    return 'free';
  }
  
  return 'standard';
};

// Track token usage - ROBUST: Every token counted, every DB operation verified
export const trackTokenUsage = async (pool, {
  userId,
  modelId,
  modelName,
  promptTokens,
  completionTokens,
  totalTokens,
  cost,
  conversationId
}) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const modelTier = getModelTier(modelId);
    
    // Insert usage record with RETURNING to verify success
    const result = await client.query(`
      INSERT INTO usage_tracking (
        user_id, model_id, model_name, model_tier,
        prompt_tokens, completion_tokens, total_tokens,
        cost, conversation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, created_at
    `, [userId, modelId, modelName, modelTier, promptTokens, completionTokens, totalTokens, cost, conversationId]);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to insert usage tracking record');
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Usage tracked: User ${userId}, Model ${modelId} (${modelTier}), Tokens ${totalTokens}`);
    
    return {
      success: true,
      usageId: result.rows[0].id,
      trackedAt: result.rows[0].created_at,
      modelTier
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Usage tracking failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get daily usage by tier for a user - CRYSTAL CLEAR QUERIES
export const getDailyUsageByTier = async (pool, userId, date = null) => {
  const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    const result = await pool.query(`
      SELECT 
        model_tier,
        SUM(total_tokens) as tokens_used,
        COUNT(*) as requests_count,
        SUM(cost) as total_cost
      FROM usage_tracking 
      WHERE user_id = $1 
        AND DATE(created_at) = $2
      GROUP BY model_tier
    `, [userId, targetDate]);
    
    // Convert to easy-to-use object
    const usage = {
      ultra_premium: 0,
      premium: 0,
      standard: 0,
      free: 0
    };
    
    result.rows.forEach(row => {
      usage[row.model_tier] = parseInt(row.tokens_used);
    });
    
    console.log(`📊 Daily usage for user ${userId} on ${targetDate}:`, usage);
    
    return {
      date: targetDate,
      usage,
      details: result.rows
    };
    
  } catch (error) {
    console.error('❌ Failed to get daily usage:', error);
    throw error;
  }
};

// Check if user can use a model tier - ENFORCEMENT LOGIC
export const canUseModelTier = async (pool, userId, modelId, requiredTokens = 4000) => {
  try {
    // Get user's subscription plan
    const userResult = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const userPlan = userResult.rows[0].subscription_tier || 'explore';
    const modelTier = getModelTier(modelId);
    
    // Get plan limits
    const planLimits = PLAN_LIMITS[userPlan];
    if (!planLimits) {
      throw new Error(`Invalid subscription plan: ${userPlan}`);
    }
    
    const dailyLimit = planLimits[modelTier];
    
    // -1 means unlimited
    if (dailyLimit === -1) {
      return {
        allowed: true,
        reason: 'unlimited',
        remainingTokens: Number.MAX_SAFE_INTEGER,
        userPlan,
        modelTier
      };
    }
    
    // Get current daily usage
    const dailyUsage = await getDailyUsageByTier(pool, userId);
    const currentUsage = dailyUsage.usage[modelTier] || 0;
    const remainingTokens = Math.max(0, dailyLimit - currentUsage);
    
    const allowed = (currentUsage + requiredTokens) <= dailyLimit;
    
    console.log(`🔍 Usage check: User ${userId}, Plan ${userPlan}, Tier ${modelTier}`);
    console.log(`   Current: ${currentUsage}/${dailyLimit}, Required: ${requiredTokens}, Allowed: ${allowed}`);
    
    return {
      allowed,
      reason: allowed ? 'within_limits' : 'exceeds_daily_limit',
      remainingTokens,
      currentUsage,
      dailyLimit,
      userPlan,
      modelTier,
      requiredTokens
    };
    
  } catch (error) {
    console.error('❌ Failed to check model tier usage:', error);
    throw error;
  }
};

// Get comprehensive usage stats for a user
export const getUserUsageStats = async (pool, userId, days = 30) => {
  try {
    const result = await pool.query(`
      SELECT 
        model_tier,
        DATE(created_at) as usage_date,
        SUM(total_tokens) as tokens_used,
        COUNT(*) as requests_count,
        SUM(cost) as daily_cost
      FROM usage_tracking 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY model_tier, DATE(created_at)
      ORDER BY usage_date DESC, model_tier
    `, [userId]);
    
    // Get user plan
    const userResult = await pool.query('SELECT subscription_tier FROM users WHERE id = $1', [userId]);
    const userPlan = userResult.rows[0]?.subscription_tier || 'explore';
    
    // Get today's usage
    const todayUsage = await getDailyUsageByTier(pool, userId);
    
    // Calculate plan limits
    const planLimits = PLAN_LIMITS[userPlan];
    
    return {
      userPlan,
      planLimits,
      todayUsage: todayUsage.usage,
      historicalData: result.rows,
      remainingTokens: {
        ultra_premium: planLimits.ultra_premium === -1 ? -1 : Math.max(0, planLimits.ultra_premium - todayUsage.usage.ultra_premium),
        premium: planLimits.premium === -1 ? -1 : Math.max(0, planLimits.premium - todayUsage.usage.premium),
        standard: planLimits.standard === -1 ? -1 : Math.max(0, planLimits.standard - todayUsage.usage.standard),
        free: planLimits.free === -1 ? -1 : Math.max(0, planLimits.free - todayUsage.usage.free)
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to get user usage stats:', error);
    throw error;
  }
};