import { useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
  Sparkles
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

export const Billing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string>('starter');

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
        'No monthly commitment',
        'Standard processing speed'
      ]
    },
    {
      id: 'starter',
      name: 'Starter Pack',
      price: billingCycle === 'monthly' ? 19 : 190,
      tokens: '250,000',
      overageRate: '$0.76 per 10K',
      icon: <Rocket className="w-6 h-6" />,
      popular: true,
      color: 'orange',
      features: [
        '250,000 tokens included',
        'All AI models available',
        'Priority processing',
        'Extended conversation history',
        'Email support',
        'Usage analytics dashboard'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: billingCycle === 'monthly' ? 49 : 490,
      tokens: '750,000',
      overageRate: '$0.65 per 10K',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'black',
      features: [
        '750,000 tokens included',
        'Advanced analytics & insights',
        'Conversation history export',
        'API access & webhooks',
        'Custom model configurations',
        'Priority email support',
        'Team collaboration tools'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: billingCycle === 'monthly' ? 199 : 1990,
      tokens: '3,000,000',
      overageRate: '$0.50 per 10K',
      icon: <Building2 className="w-6 h-6" />,
      badge: 'Most Popular',
      color: 'purple',
      features: [
        '3M tokens included',
        'Custom model endpoints',
        'Advanced team management',
        'Dedicated support manager',
        'SSO & enterprise security',
        'Custom integrations',
        'SLA guarantees',
        'White-label options'
      ]
    }
  ];

  const currentUserTier = user?.subscription?.tier || 'explore';
  const monthlyTokenUsage = user?.usage?.currentMonth || 0;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    if (planId !== 'explore') {
      // TODO: Navigate to payment flow when Stripe is integrated
      alert('Payment integration coming soon! You selected: ' + pricingTiers.find(t => t.id === planId)?.name);
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

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                billingCycle === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                Save 17%
              </span>
            </button>
          </div>

          {currentUserTier !== 'explore' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <p className="text-sm text-blue-700">
                <strong>Current Plan:</strong> {pricingTiers.find(t => t.id === currentUserTier)?.name}
                <span className="ml-4">
                  <strong>Tokens Used:</strong> {monthlyTokenUsage.toLocaleString()} this month
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Pricing Grid */}
        <div className="grid lg:grid-cols-4 gap-8 mb-16">
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
                    {tier.price > 0 && (
                      <span className="text-gray-500 ml-1">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    <strong>{tier.tokens}</strong> tokens{tier.price > 0 ? '/month' : ''}
                  </p>
                  {tier.overageRate !== 'N/A' && (
                    <p className="text-sm text-gray-500 mt-2">
                      {tier.overageRate} beyond allowance
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
                      <span>{tier.price === 0 ? 'Get Started Free' : 'Upgrade Now'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {tier.price > 0 && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Cancel anytime • No setup fees
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
                  { feature: 'Monthly Token Allowance', values: ['50K', '250K', '750K', '3M'] },
                  { feature: 'AI Model Access', values: [true, true, true, true] },
                  { feature: 'Priority Processing', values: [false, true, true, true] },
                  { feature: 'Advanced Analytics', values: [false, false, true, true] },
                  { feature: 'API Access', values: [false, false, true, true] },
                  { feature: 'Team Management', values: [false, false, false, true] },
                  { feature: 'Dedicated Support', values: [false, false, false, true] },
                  { feature: 'Custom Integrations', values: [false, false, false, true] },
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
                <h4 className="font-semibold text-gray-900 mb-2">Do you offer refunds?</h4>
                <p className="text-gray-600 text-sm">
                  We offer a 30-day money-back guarantee for all paid plans, no questions asked.
                </p>
              </div>
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
      </div>
    </div>
  );
};