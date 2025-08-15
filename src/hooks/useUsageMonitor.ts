import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';

interface TierUsage {
  ultra_premium: number;
  premium: number;
  standard: number;
  free: number;
}

interface UsageData {
  // New tier-based data
  userPlan: string;
  todayUsage: TierUsage;
  remainingTokens: TierUsage;
  planLimits: {
    ultra_premium: number;
    premium: number;
    standard: number;
    free: number;
  };
  
  // Legacy compatibility
  totalTokens: number;
  totalConversations: number;
  totalCost: number;
  historicalData: any[];
}

// UNIVERSAL PLAN LIMITS - ALL SUBSCRIPTION PLANS HAVE SAME TIER LIMITS
const TIER_LIMITS = {
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

export const useUsageMonitor = () => {
  const { user, token } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [hasShownInitialModal, setHasShownInitialModal] = useState(false);

  // Check usage every 30 seconds during active conversations
  useEffect(() => {
    if (!user || !token) return;

    const checkUsage = async () => {
      try {
        const response = await fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUsage(data);

          // Check if user has exceeded or is approaching limit
          const currentPlan = user.subscription_tier || 'explore';
          const tierLimits = TIER_LIMITS[currentPlan as keyof typeof TIER_LIMITS];
          
          if (tierLimits && data.todayUsage) {
            const now = Date.now();
            
            // Check if user has exceeded limits for LIMITED tiers ONLY
            let isOverLimit = false;
            let approachingLimit = false;
            
            // Check ultra_premium tier ONLY if it has limits (> 0)
            if (tierLimits.ultra_premium > 0 && data.todayUsage.ultra_premium > tierLimits.ultra_premium) {
              isOverLimit = true;
            } else if (tierLimits.ultra_premium > 0 && data.todayUsage.ultra_premium > tierLimits.ultra_premium * 0.9) {
              approachingLimit = true;
            }
            
            // Check premium tier ONLY if it has limits (> 0)
            if (tierLimits.premium > 0 && data.todayUsage.premium > tierLimits.premium) {
              isOverLimit = true;
            } else if (tierLimits.premium > 0 && data.todayUsage.premium > tierLimits.premium * 0.9) {
              approachingLimit = true;
            }
            
            // NEVER check standard/free tiers - they are unlimited (-1)
            
            const cooldownTime = isOverLimit ? 2 * 60 * 1000 : 10 * 60 * 1000; // 2 min vs 10 min
            
            // Show modal if over limit or approaching limit
            if ((isOverLimit || approachingLimit) && 
                (!hasShownInitialModal || (now - lastCheckTime > cooldownTime))) {
              setShowLimitModal(true);
              setLastCheckTime(now);
              if (!hasShownInitialModal) {
                setHasShownInitialModal(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to check usage:', error);
      }
    };

    // Check immediately
    checkUsage();

    // Then check every 30 seconds during active use
    const interval = setInterval(checkUsage, 30000);
    return () => clearInterval(interval);
  }, [user, token, lastCheckTime]);

  const getCurrentPlanLimit = () => {
    const currentPlan = user?.subscription_tier || 'explore';
    return TIER_LIMITS[currentPlan as keyof typeof TIER_LIMITS];
  };

  const getUsageStatus = () => {
    if (!usage || !user) return null;

    const tierLimits = getCurrentPlanLimit();
    
    // Check if over limit for LIMITED tiers ONLY
    let isOverLimit = false;
    let overageAmount = 0;
    
    // Check ultra_premium tier ONLY if it has limits (> 0)
    if (tierLimits.ultra_premium > 0 && usage.todayUsage.ultra_premium > tierLimits.ultra_premium) {
      isOverLimit = true;
      overageAmount = usage.todayUsage.ultra_premium - tierLimits.ultra_premium;
    }
    
    // Check premium tier ONLY if it has limits (> 0)
    if (tierLimits.premium > 0 && usage.todayUsage.premium > tierLimits.premium) {
      isOverLimit = true;
      overageAmount = Math.max(overageAmount, usage.todayUsage.premium - tierLimits.premium);
    }
    
    // NEVER check standard/free tiers - they are unlimited (-1)
    
    // Use total tokens for legacy percentage calculation
    const totalDailyUsage = Object.values(usage.todayUsage).reduce((sum, tokens) => sum + tokens, 0);
    const totalDailyLimit = Object.values(tierLimits).filter(limit => limit !== -1).reduce((sum, limit) => sum + limit, 0);
    const usagePercentage = totalDailyLimit > 0 ? (totalDailyUsage / totalDailyLimit) * 100 : 0;

    return {
      // New tier-based data
      todayUsage: usage.todayUsage,
      remainingTokens: usage.remainingTokens,
      tierLimits,
      
      // Legacy compatibility
      currentUsage: totalDailyUsage,
      usageLimit: totalDailyLimit,
      usagePercentage,
      isOverLimit,
      overageAmount,
      currentPlan: user.subscription_tier || 'explore'
    };
  };

  const closeModal = () => {
    setShowLimitModal(false);
  };

  // Check if user can use a specific model
  const canUseModel = async (modelId: string): Promise<{allowed: boolean; reason?: string; message?: string}> => {
    if (!user || !token) {
      return { allowed: false, reason: 'not_authenticated', message: 'Please log in to continue' };
    }
    
    try {
      const response = await fetch(`${API_URL}/api/usage/check`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ modelId, estimatedTokens: 4000 })
      });
      
      if (response.ok) {
        const result = await response.json();
        return {
          allowed: result.allowed,
          reason: result.reason,
          message: result.message
        };
      } else {
        return { allowed: false, reason: 'check_failed', message: 'Failed to check usage limits' };
      }
    } catch (error) {
      console.error('Failed to check model usage:', error);
      return { allowed: true, reason: 'check_error', message: 'Proceeding due to check error' };
    }
  };

  // Force check usage (for after conversations)
  const recheckUsage = async () => {
    if (!user || !token) return;
    
    try {
      const response = await fetch(`${API_URL}/api/usage/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Failed to recheck usage:', error);
    }
  };

  return {
    usage,
    showLimitModal,
    closeModal,
    getUsageStatus,
    getCurrentPlanLimit,
    canUseModel,
    recheckUsage
  };
};