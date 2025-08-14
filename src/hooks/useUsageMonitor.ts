import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';

interface UsageData {
  totalTokens: number;
  totalConversations: number;
  totalCost: number;
}

interface PlanLimits {
  explore: { tokens: 50000; price: 0 };
  starter: { tokens: 250000; price: 19 };
  professional: { tokens: 750000; price: 49 };
  enterprise: { tokens: 3000000; price: 199 };
}

const PLAN_LIMITS: PlanLimits = {
  explore: { tokens: 50000, price: 0 },
  starter: { tokens: 250000, price: 19 },
  professional: { tokens: 750000, price: 49 },
  enterprise: { tokens: 3000000, price: 199 }
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
          setUsage({
            totalTokens: data.totalTokens || 0,
            totalConversations: data.totalConversations || 0,
            totalCost: data.totalCost || 0
          });

          // Check if user has exceeded or is approaching limit
          const currentPlan = user.subscription_tier || 'explore';
          const planLimit = PLAN_LIMITS[currentPlan as keyof PlanLimits];
          
          if (planLimit && data.totalTokens > 0) {
            const usagePercentage = (data.totalTokens / planLimit.tokens) * 100;
            const now = Date.now();
            
            // Show modal if:
            // 1. Usage > 100% of limit (over-limit users) - show every 2 minutes
            // 2. Usage > 95% of limit (approaching limit) - show every 10 minutes
            const isOverLimit = data.totalTokens > planLimit.tokens;
            const cooldownTime = isOverLimit ? 2 * 60 * 1000 : 10 * 60 * 1000; // 2 min vs 10 min
            
            // Show modal immediately on first load if over limit, or with cooldown for subsequent checks
            if ((usagePercentage >= 95 || isOverLimit) && 
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
    return PLAN_LIMITS[currentPlan as keyof PlanLimits];
  };

  const getUsageStatus = () => {
    if (!usage || !user) return null;

    const planLimit = getCurrentPlanLimit();
    const usagePercentage = (usage.totalTokens / planLimit.tokens) * 100;
    const isOverLimit = usage.totalTokens > planLimit.tokens;
    const overageAmount = isOverLimit ? usage.totalTokens - planLimit.tokens : 0;

    return {
      currentUsage: usage.totalTokens,
      usageLimit: planLimit.tokens,
      usagePercentage,
      isOverLimit,
      overageAmount,
      currentPlan: user.subscription_tier || 'explore'
    };
  };

  const closeModal = () => {
    setShowLimitModal(false);
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
        setUsage({
          totalTokens: data.totalTokens || 0,
          totalConversations: data.totalConversations || 0,
          totalCost: data.totalCost || 0
        });
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
    recheckUsage
  };
};