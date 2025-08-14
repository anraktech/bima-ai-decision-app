import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


interface UsageData {
  currentMonth: number;
  lastMonth: number;
  totalAllTime: number;
  dailyUsage: { date: string; tokens: number }[];
  conversationStats: {
    total: number;
    thisMonth: number;
    averageTokensPerConversation: number;
  };
}

interface SubscriptionData {
  tier: 'explore' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  tokensIncluded: number;
  tokensUsed: number;
  overageTokens: number;
  nextBillingAmount: number;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface InvoiceData {
  id: string;
  date: Date;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  period: string;
  downloadUrl?: string;
  tokensUsed: number;
  overageAmount: number;
}

interface BillingContextType {
  subscription: SubscriptionData | null;
  usage: UsageData | null;
  invoices: InvoiceData[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateSubscription: (tier: string, billingCycle: 'monthly' | 'annual') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  updatePaymentMethod: (paymentMethodId: string) => Promise<void>;
  downloadInvoice: (invoiceId: string) => Promise<void>;
  trackTokenUsage: (tokens: number, conversationId?: string) => Promise<void>;
  
  // Utility functions
  getRemainingTokens: () => number;
  getOverageRate: () => number;
  canUpgrade: () => boolean;
  getUsagePercentage: () => number;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
};

const TIER_CONFIGS = {
  explore: { tokens: 50000, overageRate: 0, price: 0 },
  starter: { tokens: 750000, overageRate: 0.50, price: 10 },
  professional: { tokens: 750000, overageRate: 0.50, price: 10 }, // Legacy - same as starter
  enterprise: { tokens: 999999999, overageRate: 0, price: 500 }
};

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize billing data
  useEffect(() => {
    if (user) {
      initializeBillingData();
    } else {
      // If no user, set loading to false to prevent infinite loading
      setIsLoading(false);
    }
  }, [user]);

  const initializeBillingData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, these would be API calls
      await Promise.all([
        fetchSubscriptionData(),
        fetchUsageData(),
        fetchInvoices()
      ]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      // Get actual usage stats from API
      const token = localStorage.getItem('token');
      if (!token) return;

      // First get current user data to ensure we have the latest subscription tier
      const userResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const response = await fetch(`${API_URL}/api/usage/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok && userResponse.ok) {
        const usageData = await response.json();
        const currentUser = await userResponse.json();
        
        console.log('BillingContext - Current user data:', currentUser);
        console.log('BillingContext - Usage data:', usageData);
        
        // Create subscription data based on current user tier and actual usage
        const userTier = currentUser.subscription_tier || 'explore';
        console.log('BillingContext - User tier determined:', userTier);
        const tierConfig = TIER_CONFIGS[userTier as keyof typeof TIER_CONFIGS];
        
        const subscription: SubscriptionData = {
          tier: userTier as SubscriptionData['tier'],
          status: 'active',
          currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          tokensIncluded: tierConfig.tokens,
          tokensUsed: usageData.totalTokens || 0,
          overageTokens: Math.max(0, (usageData.totalTokens || 0) - tierConfig.tokens),
          nextBillingAmount: tierConfig.price,
          cancelAtPeriodEnd: false
        };
        
        setSubscription(subscription);
      } else {
        console.log('BillingContext - API calls failed, using fallback. Response OK:', response.ok, 'User Response OK:', userResponse.ok);
        console.log('BillingContext - Fallback user data:', user);
        // Fallback to basic subscription
        const userTier = user?.subscription_tier || 'explore';
        console.log('BillingContext - Fallback user tier:', userTier);
        const tierConfig = TIER_CONFIGS[userTier as keyof typeof TIER_CONFIGS];
        setSubscription({
          tier: userTier as SubscriptionData['tier'],
          status: 'active',
          currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          tokensIncluded: tierConfig.tokens,
          tokensUsed: 0,
          overageTokens: 0,
          nextBillingAmount: tierConfig.price,
          cancelAtPeriodEnd: false
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    }
  };

  const fetchUsageData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/usage/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const usageData = await response.json();
        
        // Transform API data to match our UsageData interface
        const usage: UsageData = {
          currentMonth: usageData.totalTokens || 0,
          lastMonth: 0, // Would need separate API endpoint for historical data
          totalAllTime: usageData.totalTokens || 0,
          dailyUsage: usageData.dailyUsage || [],
          conversationStats: {
            total: usageData.totalConversations || 0,
            thisMonth: usageData.totalConversations || 0,
            averageTokensPerConversation: usageData.totalTokens && usageData.totalConversations 
              ? Math.round(usageData.totalTokens / usageData.totalConversations) 
              : 0
          }
        };
        
        setUsage(usage);
      } else {
        // Fallback to empty usage
        setUsage({
          currentMonth: 0,
          lastMonth: 0,
          totalAllTime: 0,
          dailyUsage: [],
          conversationStats: {
            total: 0,
            thisMonth: 0,
            averageTokensPerConversation: 0
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    }
  };

  const fetchInvoices = async () => {
    // Mock invoices - replace with actual API call
    const mockInvoices: InvoiceData[] = [
      {
        id: 'inv_123',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        amount: 0,
        status: 'paid',
        period: 'Nov 2024',
        tokensUsed: 8200,
        overageAmount: 0
      }
    ];
    
    setInvoices(mockInvoices);
  };

  const updateSubscription = async (tier: string, billingCycle: 'monthly' | 'annual') => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock API call to update subscription
      console.log('Updating subscription to:', tier, billingCycle);
      
      // Update subscription data
      if (subscription) {
        const tierConfig = TIER_CONFIGS[tier as keyof typeof TIER_CONFIGS];
        const updatedSubscription = {
          ...subscription,
          tier: tier as SubscriptionData['tier'],
          tokensIncluded: tierConfig.tokens,
          nextBillingAmount: billingCycle === 'annual' ? tierConfig.price * 10 : tierConfig.price
        };
        setSubscription(updatedSubscription);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock API call to cancel subscription
      console.log('Cancelling subscription');
      
      if (subscription) {
        setSubscription({
          ...subscription,
          cancelAtPeriodEnd: true
        });
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reactivateSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock API call to reactivate subscription
      console.log('Reactivating subscription');
      
      if (subscription) {
        setSubscription({
          ...subscription,
          cancelAtPeriodEnd: false
        });
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentMethod = async (paymentMethodId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock API call to update payment method
      console.log('Updating payment method:', paymentMethodId);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment method');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId: string) => {
    try {
      // Mock API call to download invoice
      console.log('Downloading invoice:', invoiceId);
      
      // In real implementation, this would download the PDF
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        // Create a mock PDF download
        const element = document.createElement('a');
        element.href = 'data:text/plain;charset=utf-8,Invoice ' + invoiceId;
        element.download = `ANRAK_Invoice_${invoiceId}.pdf`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice');
      throw err;
    }
  };

  const trackTokenUsage = async (tokens: number, conversationId?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Call the actual tracking API
      const response = await fetch(`${API_URL}/api/usage/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelId: 'unknown',
          modelName: 'Unknown Model',
          promptTokens: Math.floor(tokens * 0.7),
          completionTokens: Math.floor(tokens * 0.3),
          totalTokens: tokens,
          conversationId: conversationId
        })
      });

      if (response.ok) {
        // Refresh the usage data after successful tracking
        await Promise.all([
          fetchUsageData(),
          fetchSubscriptionData()
        ]);
      } else {
        console.error('Failed to track token usage');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track token usage');
      throw err;
    }
  };

  // Utility functions
  const getRemainingTokens = () => {
    if (!subscription) return 0;
    return Math.max(0, subscription.tokensIncluded - subscription.tokensUsed);
  };

  const getOverageRate = () => {
    if (!subscription) return 0;
    return TIER_CONFIGS[subscription.tier].overageRate;
  };

  const canUpgrade = () => {
    if (!subscription) return true;
    return subscription.tier !== 'enterprise';
  };

  const getUsagePercentage = () => {
    if (!subscription) return 0;
    return Math.min(100, (subscription.tokensUsed / subscription.tokensIncluded) * 100);
  };

  const value: BillingContextType = {
    subscription,
    usage,
    invoices,
    isLoading,
    error,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    updatePaymentMethod,
    downloadInvoice,
    trackTokenUsage,
    getRemainingTokens,
    getOverageRate,
    canUpgrade,
    getUsagePercentage
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
};