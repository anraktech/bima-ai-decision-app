// Robust Token-Based Usage Tier System
// Every token is tracked, every limit is enforced

export interface TierLimits {
  ultra_premium: number;
  premium: number;
  standard: number;
  free: number;
}

export interface SubscriptionPlan {
  name: string;
  price: number;
  dailyLimits: TierLimits;
  monthlyLimits: TierLimits;
  features: string[];
}

// Daily token limits per tier (resets at midnight UTC)
// UNIVERSAL LIMITS: All subscription plans have the same tier-based daily limits
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  explore: {
    name: 'Explore (Free)',
    price: 0,
    dailyLimits: {
      ultra_premium: 20000,   // 🔴 Ultra Premium: 20,000 tokens/day (GPT-5, Claude Opus 4.1)
      premium: 50000,         // 🟡 Premium: 50,000 tokens/day (GPT-4o, Claude 3.5, Gemini 2.5)
      standard: -1,           // 🟢 Standard: Unlimited (Most other models)
      free: -1                // ⚪ Free: Unlimited (Free tier models)
    },
    monthlyLimits: {
      ultra_premium: 600000,  // 20k * 30 days
      premium: 1500000,       // 50k * 30 days  
      standard: -1,           // Unlimited
      free: -1                // Unlimited
    },
    features: [
      'Access to all AI models',
      'Limited premium model usage',
      'Community support'
    ]
  },
  
  starter: {
    name: 'Starter',
    price: 19,
    dailyLimits: {
      ultra_premium: 20000,   // 🔴 Ultra Premium: 20,000 tokens/day (GPT-5, Claude Opus 4.1)
      premium: 50000,         // 🟡 Premium: 50,000 tokens/day (GPT-4o, Claude 3.5, Gemini 2.5)
      standard: -1,           // 🟢 Standard: Unlimited (Most other models)
      free: -1                // ⚪ Free: Unlimited (Free tier models)
    },
    monthlyLimits: {
      ultra_premium: 3000000, // 100k * 30 days
      premium: 7500000,       // 250k * 30 days
      standard: -1,           // Unlimited
      free: -1                // Unlimited
    },
    features: [
      'Higher daily limits',
      'Priority model access',
      'Email support',
      'Usage analytics'
    ]
  },

  professional: {
    name: 'Professional', 
    price: 49,
    dailyLimits: {
      ultra_premium: 20000,   // 🔴 Ultra Premium: 20,000 tokens/day (GPT-5, Claude Opus 4.1)
      premium: 50000,         // 🟡 Premium: 50,000 tokens/day (GPT-4o, Claude 3.5, Gemini 2.5)
      standard: -1,           // 🟢 Standard: Unlimited (Most other models)
      free: -1                // ⚪ Free: Unlimited (Free tier models)
    },
    monthlyLimits: {
      ultra_premium: 15000000, // 500k * 30 days
      premium: -1,             // Unlimited
      standard: -1,            // Unlimited
      free: -1                 // Unlimited
    },
    features: [
      'Unlimited premium models',
      'High ultra-premium limits',
      'Priority support',
      'Advanced analytics',
      'Custom model sharing'
    ]
  },

  enterprise: {
    name: 'Enterprise',
    price: 199,
    dailyLimits: {
      ultra_premium: 20000,   // 🔴 Ultra Premium: 20,000 tokens/day (GPT-5, Claude Opus 4.1)
      premium: 50000,         // 🟡 Premium: 50,000 tokens/day (GPT-4o, Claude 3.5, Gemini 2.5)
      standard: -1,           // 🟢 Standard: Unlimited (Most other models)
      free: -1                // ⚪ Free: Unlimited (Free tier models)
    },
    monthlyLimits: {
      ultra_premium: -1,      // Unlimited everything
      premium: -1,            // Unlimited
      standard: -1,           // Unlimited
      free: -1                // Unlimited
    },
    features: [
      'Unlimited everything',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantees',
      'Team collaboration'
    ]
  }
};

// Model tier classification for token counting
export const MODEL_TIERS: Record<string, string> = {
  // Ultra Premium ($10+ per 1M output tokens)
  'openai/gpt-5': 'ultra_premium',
  'openai/gpt-5-chat': 'ultra_premium',
  'openai/o3-pro': 'ultra_premium',
  'openai/o3': 'ultra_premium',
  'anthropic/claude-opus-4.1': 'ultra_premium',
  'anthropic/claude-opus-4': 'ultra_premium',
  'x-ai/grok-4': 'ultra_premium',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1': 'ultra_premium',

  // Premium ($2-10 per 1M output tokens)
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
  'deepseek/deepseek-chat': 'premium',
  'meta-llama/llama-4-maverick': 'premium',

  // Default fallback logic
  default: 'standard'
};

// Get model tier from model ID
export const getModelTier = (modelId: string): keyof TierLimits => {
  // Check exact matches first
  if (MODEL_TIERS[modelId]) {
    return MODEL_TIERS[modelId] as keyof TierLimits;
  }

  // Fallback pattern matching
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
  
  // Default to standard
  return 'standard';
};

// Check if user can use a specific tier based on current usage
export const canUseModelTier = (
  tier: keyof TierLimits,
  userPlan: string,
  dailyUsage: Record<string, number>
): boolean => {
  const plan = SUBSCRIPTION_PLANS[userPlan];
  if (!plan) return false;
  
  const dailyLimit = plan.dailyLimits[tier];
  
  // -1 means unlimited
  if (dailyLimit === -1) return true;
  
  const currentUsage = dailyUsage[tier] || 0;
  return currentUsage < dailyLimit;
};

// Get remaining tokens for a tier today
export const getRemainingTokens = (
  tier: keyof TierLimits,
  userPlan: string,
  dailyUsage: Record<string, number>
): number => {
  const plan = SUBSCRIPTION_PLANS[userPlan];
  if (!plan) return 0;
  
  const dailyLimit = plan.dailyLimits[tier];
  
  // -1 means unlimited
  if (dailyLimit === -1) return Number.MAX_SAFE_INTEGER;
  
  const currentUsage = dailyUsage[tier] || 0;
  return Math.max(0, dailyLimit - currentUsage);
};