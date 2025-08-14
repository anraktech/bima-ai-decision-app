import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
// Removed PaymentLinkButton import - using direct implementation
import { API_URL } from '../config/api';
import { 
  Check, 
  X, 
  Crown, 
  Zap, 
  Building2, 
  Rocket,
  CreditCard,
  BarChart3,
  Users,
  Download,
  Headphones,
  Database,
  Globe,
  ArrowRight,
  Sparkles,
  Settings,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface PricingTier {
  id: string;
  name: string;
  price: number;
  tokens: string;
  overageRate: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
  badge?: string;
  color: 'orange' | 'gray' | 'black' | 'purple';
}

interface SubscriptionData {
  plan_type: string;
  current_period_start: string;
  current_period_end: string;
  period_tokens_used: number;
  period_tokens_limit: number;
  cancel_at_period_end?: boolean;
}

export const Billing = () => {
  const { user, token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [billingCycle] = useState<'monthly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>('starter');
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentButton, setShowPaymentButton] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<{
    type: string;
    name: string;
    price: number;
  } | null>(null);

  const pricingTiers: PricingTier[] = [
    {
      id: 'explore',
      name: 'Explore',
      price: 0,
      tokens: '50,000',
      overageRate: 'N/A',
      icon: <Sparkles className="w-6 h-6" />,
      badge: 'Free Forever',
      color: 'gray',
      features: [
        '50,000 free tokens/month',
        'Access to all AI models',
        'Basic conversation history',
        'Community support',
        'Standard processing speed'
      ]
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 10,
      tokens: '750,000',
      overageRate: '$0.50 per 10K',
      icon: <Rocket className="w-6 h-6" />,
      popular: true,
      color: 'orange',
      features: [
        '750,000 tokens/month',
        'All AI models available',
        'Priority processing',
        'Advanced analytics & insights',
        'Conversation history export',
        'API access & webhooks',
        'Custom model configurations',
        'Priority email support',
        'Team collaboration tools',
        'Usage analytics dashboard'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 500,
      tokens: 'Unlimited*',
      overageRate: 'Use your own API keys',
      icon: <Building2 className="w-6 h-6" />,
      badge: 'One-Time Payment',
      color: 'black',
      features: [
        'Bring your own API keys',
        'Unlimited tokens with your keys',
        'White-label options',
        'Custom branding',
        'Advanced team management',
        'Dedicated support',
        'Custom integrations',
        'Source code access',
        'Lifetime updates',
        'Priority feature requests'
      ]
    }
  ];

  // Fetch subscription data using accurate usage stats
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!token) return;
      
      try {
        // First, refresh user data to ensure we have latest subscription tier
        const currentUserData = await refreshUser() || user;
        
        // Use the same accurate API as Profile page
        const response = await fetch(`${API_URL}/api/usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const usageData = await response.json();
          
          // Create subscription data based on current user tier and actual usage
          const userTier = currentUserData?.subscription_tier || user?.subscription_tier || 'explore';
          const tierLimits = {
            explore: 50000,
            starter: 750000,
            professional: 750000, // Legacy - same as starter now
            enterprise: 999999999 // Unlimited with own keys
          };
          
          const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
          
          setSubscription({
            plan_type: userTier,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            period_tokens_used: usageData.totalTokens || 0,
            period_tokens_limit: tierLimits[userTier as keyof typeof tierLimits] || 50000,
            cancel_at_period_end: false
          });
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [token, user, refreshUser]);

  const currentUserTier = subscription?.plan_type || user?.subscription_tier || 'explore';
  const monthlyTokenUsage = subscription?.period_tokens_used || 0;
  const tokenLimit = subscription?.period_tokens_limit || 50000;
  const usagePercentage = Math.round((monthlyTokenUsage / tokenLimit) * 100);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    if (planId !== 'explore' && planId !== currentUserTier) {
      const selectedTier = pricingTiers.find(t => t.id === planId);
      if (selectedTier) {
        setSelectedPaymentPlan({
          type: planId,
          name: selectedTier.name,
          price: selectedTier.price
        });
        setShowPaymentButton(true);
      }
    } else if (planId === 'explore') {
      // Free plan selected - no payment needed
      return;
    }
  };

  const handlePaymentSuccess = async () => {
    // Refresh subscription data using the same accurate API
    try {
      const response = await fetch(`${API_URL}/api/usage/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const usageData = await response.json();
        
        // Update user tier after successful payment - we should call auth endpoint to get updated user
        const userResponse = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (userResponse.ok) {
          const updatedUser = await userResponse.json();
          const userTier = updatedUser.subscription_tier || 'explore';
          
          const tierLimits = {
            explore: 50000,
            starter: 750000,
            professional: 750000, // Legacy - same as starter now
            enterprise: 999999999 // Unlimited with own keys
          };
          
          const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
          
          setSubscription({
            plan_type: userTier,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            period_tokens_used: usageData.totalTokens || 0,
            period_tokens_limit: tierLimits[userTier as keyof typeof tierLimits] || 50000,
            cancel_at_period_end: false
          });
        }
      }
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stripe/billing-portal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const { url } = await response.json();
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  const getColorClasses = (color: string, selected: boolean = false) => {
    switch (color) {
      case 'orange':
        return selected 
          ? 'border-orange-500 shadow-orange-100 bg-orange-50' 
          : 'border-orange-200 hover:border-orange-300 hover:shadow-orange-50';
      case 'black':
        return selected 
          ? 'border-black shadow-gray-100 bg-gray-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-gray-50';
      case 'purple':
        return selected 
          ? 'border-purple-500 shadow-purple-100 bg-purple-50' 
          : 'border-purple-200 hover:border-purple-300 hover:shadow-purple-50';
      default:
        return selected 
          ? 'border-gray-400 shadow-gray-100 bg-gray-50' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Header />
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Choose Your ANRAK Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Scale your AI decision-making power with flexible pricing that grows with your needs
          </p>


          {!isLoading && subscription && (
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
                  {currentUserTier !== 'explore' && (
                    <button
                      onClick={handleManageBilling}
                      className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Manage Billing</span>
                    </button>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        currentUserTier === 'explore' ? 'bg-gray-400' :
                        currentUserTier === 'starter' ? 'bg-orange-500' :
                        currentUserTier === 'professional' ? 'bg-black' : 'bg-purple-500'
                      }`}></div>
                      <span className="font-medium text-gray-900">
                        {pricingTiers.find(t => t.id === currentUserTier)?.name} Plan
                      </span>
                    </div>
                    {subscription.current_period_end && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {subscription.cancel_at_period_end ? 'Ends' : 'Renews'} on{' '}
                          {new Date(subscription.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Token Usage</span>
                      <span className="text-sm font-medium">
                        {monthlyTokenUsage.toLocaleString()} / {tokenLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          usagePercentage > 90 ? 'bg-red-500' :
                          usagePercentage > 75 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <TrendingUp className="w-3 h-3" />
                      <span>{usagePercentage}% used this period</span>
                    </div>
                  </div>
                </div>
                
                {subscription.cancel_at_period_end && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      <strong>Subscription Cancelled:</strong> Your plan will end on{' '}
                      {new Date(subscription.current_period_end).toLocaleDateString()}.
                      You can reactivate anytime before then.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

{/* Pricing Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-lg ${
                getColorClasses(tier.color, selectedPlan === tier.id)
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-orange-500 text-white px-4 py-1 text-sm font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Custom Badge */}
              {tier.badge && !tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gray-600 text-white px-4 py-1 text-sm font-medium rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      tier.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                      tier.color === 'black' ? 'bg-gray-100 text-gray-700' :
                      tier.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {tier.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ${tier.price}
                    </span>
                    {tier.price > 0 && tier.id !== 'enterprise' && (
                      <span className="text-gray-500 ml-1">
/mo
                      </span>
                    )}
                    {tier.id === 'enterprise' && (
                      <span className="text-gray-500 ml-1">
once
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    <strong>{tier.tokens}</strong> {tier.id === 'enterprise' ? 'with your API keys' : tier.price > 0 ? 'tokens/month' : 'tokens'}
                  </p>
                  {tier.overageRate !== 'N/A' && tier.id !== 'enterprise' && (
                    <p className="text-sm text-gray-500 mt-2">
                      {tier.overageRate} beyond allowance
                    </p>
                  )}
                  {tier.id === 'enterprise' && (
                    <p className="text-sm text-gray-500 mt-2">
                      {tier.overageRate}
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(tier.id)}
                  disabled={currentUserTier === tier.id}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                    currentUserTier === tier.id
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : tier.color === 'orange'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow hover:shadow-lg'
                      : tier.color === 'black'
                      ? 'bg-black hover:bg-gray-800 text-white shadow hover:shadow-lg'
                      : tier.color === 'purple'
                      ? 'bg-purple-500 hover:bg-purple-600 text-white shadow hover:shadow-lg'
                      : 'bg-gray-800 hover:bg-gray-900 text-white shadow hover:shadow-lg'
                  }`}
                >
                  {currentUserTier === tier.id ? (
                    <span>Current Plan</span>
                  ) : (
                    <>
                      <span>
                        {tier.price === 0 ? 'Get Started Free' : 
                         tier.id === 'enterprise' ? 'Buy Lifetime Access' : 
                         'Upgrade Now'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {tier.price > 0 && tier.id !== 'enterprise' && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Cancel anytime • No setup fees
                  </p>
                )}
                {tier.id === 'enterprise' && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    One-time payment • Lifetime access
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Feature Comparison</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-medium text-gray-900">Feature</th>
                  {pricingTiers.map(tier => (
                    <th key={tier.id} className="text-center py-4 px-4 font-medium text-gray-900">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Monthly Token Allowance', values: ['50K', '750K', 'Unlimited*'] },
                  { feature: 'AI Model Access', values: [true, true, true] },
                  { feature: 'Priority Processing', values: [false, true, true] },
                  { feature: 'Advanced Analytics', values: [false, true, true] },
                  { feature: 'API Access', values: [false, true, true] },
                  { feature: 'Bring Your Own Keys', values: [false, false, true] },
                  { feature: 'White-Label Options', values: [false, false, true] },
                  { feature: 'Lifetime Updates', values: [false, false, true] },
                  { feature: 'Source Code Access', values: [false, false, true] },
                ].map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-4 px-6 font-medium text-gray-900">{row.feature}</td>
                    {row.values.map((value, tierIndex) => (
                      <td key={tierIndex} className="py-4 px-4 text-center">
                        {typeof value === 'boolean' ? (
                          value ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className="text-gray-900 font-medium">{value}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What are tokens?</h4>
                <p className="text-gray-600 text-sm">
                  Tokens represent the computational cost of AI conversations. Roughly 1,000 tokens equals about 750 words.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Can I change my plan anytime?</h4>
                <p className="text-gray-600 text-sm">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What happens if I exceed my token limit?</h4>
                <p className="text-gray-600 text-sm">
                  You'll be charged for additional tokens at your plan's overage rate. We'll notify you before you exceed your limit.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Is my data secure?</h4>
                <p className="text-gray-600 text-sm">
                  Yes, all data is encrypted in transit and at rest. We never train AI models on your private conversations.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Need a custom plan?</h4>
                <p className="text-gray-600 text-sm">
                  Contact our sales team for enterprise custom pricing and features tailored to your organization.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Cancellation Notice */}
        <div className="mt-12 bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Need to Cancel or Change Your Subscription?</h3>
          <p className="text-gray-600 mb-4">
            We're sorry to see you go! To cancel your subscription or make changes, please email us directly.
          </p>
          <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
            <p className="text-sm text-gray-700">
              <strong>Email:</strong> <a href="mailto:kapil@anrak.io?subject=Subscription Cancellation Request" className="text-orange-600 hover:text-orange-700">kapil@anrak.io</a>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Please include your registered email address and reason for cancellation
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Cancellations are processed within 24 hours • No questions asked • Prorated refunds available
          </p>
        </div>
      </div>

      {/* Simple Payment Button Modal */}
      {showPaymentButton && selectedPaymentPlan && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Upgrade to {selectedPaymentPlan.name}</h2>
            <p className="text-gray-600 mb-6">
              You'll be redirected to Stripe's secure checkout page.
            </p>
            <button
              onClick={() => {
                // Direct payment link redirect - no components, no complexity
                const links = {
                  starter: 'https://buy.stripe.com/6oUeVdgEdchp5MX3ed3cc00', // $10/month
                  enterprise: 'https://buy.stripe.com/3cI5kDgEd6X5fnx8yx3cc02' // $500 one-time
                };
                const paymentLink = links[selectedPaymentPlan.type as keyof typeof links];
                if (paymentLink) {
                  const finalUrl = `${paymentLink}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email)}`;
                  console.log('===== BILLING PAGE DIRECT PAYMENT =====');
                  console.log('Plan Type:', selectedPaymentPlan.type);
                  console.log('Payment Link:', paymentLink);
                  console.log('User ID:', user.id);
                  console.log('User Email:', user.email);
                  console.log('Final URL:', finalUrl);
                  console.log('Redirecting NOW...');
                  // Use replace to prevent back button issues
                  window.location.replace(finalUrl);
                } else {
                  console.error('No payment link for plan:', selectedPaymentPlan.type);
                  alert('Error: Invalid plan selected. Please refresh and try again.');
                }
              }}
              className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              Pay ${selectedPaymentPlan.price}/month with Stripe
            </button>
            <button
              onClick={() => setShowPaymentButton(false)}
              className="w-full mt-3 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};