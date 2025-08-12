import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import { 
import { API_URL, getApiUrl, getWsUrl } from '../config/api';

  CreditCard, 
  Lock, 
  CheckCircle, 
  ArrowLeft,
  AlertCircle,
  Loader
} from 'lucide-react';

// Initialize Stripe - in production, move this to environment variables
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const PLAN_CONFIGS = {
  starter: { 
    name: 'Starter Pack', 
    price: 19, 
    tokens: '250K',
    priceId: 'price_starter_monthly' // This would be your Stripe Price ID
  },
  professional: { 
    name: 'Professional', 
    price: 49, 
    tokens: '750K',
    priceId: 'price_professional_monthly'
  },
  enterprise: { 
    name: 'Enterprise', 
    price: 199, 
    tokens: '3M',
    priceId: 'price_enterprise_monthly'
  }
};

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateSubscription } = useBilling();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  
  const planId = searchParams.get('plan') as keyof typeof PLAN_CONFIGS;
  const billingCycle = searchParams.get('cycle') || 'monthly';
  const plan = PLAN_CONFIGS[planId];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements || !plan) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setError('Card information is required');
      setIsLoading(false);
      return;
    }

    try {
      // Create payment method
      const { error: paymentError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: user?.name,
          email: user?.email,
        },
      });

      if (paymentError) {
        setError(paymentError.message || 'Payment failed');
        setIsLoading(false);
        return;
      }

      // Create subscription on your backend
      const response = await fetch('${API_URL}/api/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          paymentMethodId: paymentMethod.id,
          billingCycle,
        }),
      });

      const subscription = await response.json();

      if (!response.ok) {
        throw new Error(subscription.error || 'Subscription creation failed');
      }

      // Handle 3D Secure if needed
      if (subscription.status === 'incomplete') {
        const { error: confirmError } = await stripe.confirmCardPayment(
          subscription.client_secret
        );

        if (confirmError) {
          setError(confirmError.message || 'Payment confirmation failed');
          setIsLoading(false);
          return;
        }
      }

      // Update local billing context
      await updateSubscription(planId, billingCycle as 'monthly' | 'annual');
      
      setSucceeded(true);
      
      // Redirect to success page after a delay
      setTimeout(() => {
        navigate('/billing?success=true');
      }, 2000);

    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment processing failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Plan</h2>
          <p className="text-gray-600 mb-4">The selected plan could not be found.</p>
          <button
            onClick={() => navigate('/billing')}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">
            Welcome to ANRAK {plan.name}! Your subscription is now active.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Plan</span>
              <span className="font-semibold">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-600">Tokens</span>
              <span className="font-semibold">{plan.tokens}/month</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-600">Price</span>
              <span className="font-semibold">${plan.price}/month</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">Redirecting to your billing dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Complete Your Subscription</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upgrading to {plan.name} • ${plan.price}/{billingCycle === 'annual' ? 'year' : 'month'}
          </p>
        </div>

        {/* Order Summary */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{plan.name} Plan</span>
              <span className="font-semibold">${plan.price}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tokens Included</span>
              <span className="font-semibold">{plan.tokens}/month</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Billing Cycle</span>
              <span className="font-semibold capitalize">{billingCycle}</span>
            </div>
            {billingCycle === 'annual' && (
              <div className="flex items-center justify-between text-green-600">
                <span>Annual Discount (17%)</span>
                <span>-${Math.round(plan.price * 12 * 0.17)}</span>
              </div>
            )}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-lg font-bold">
                ${billingCycle === 'annual' ? Math.round(plan.price * 10) : plan.price}
                /{billingCycle === 'annual' ? 'year' : 'month'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Information
              </label>
              <div className="border border-gray-300 rounded-lg p-3">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#424770',
                        '::placeholder': {
                          color: '#aab7c4',
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Secure Payment</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Your payment information is encrypted and secure. Cancel anytime.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!stripe || isLoading}
              className="w-full py-3 px-4 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Subscribe to {plan.name}</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              By subscribing, you agree to our Terms of Service and Privacy Policy.
              You can cancel your subscription at any time.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Checkout = () => {
  const navigate = useNavigate();
  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!stripePublishableKey) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Header />
              <button
                onClick={() => navigate('/billing')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Pricing</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment System Configuration</h2>
            <p className="text-gray-600 mb-4">
              Stripe payment processing is not yet configured. Please add your Stripe publishable key to enable payments.
            </p>
            <button
              onClick={() => navigate('/billing')}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Pricing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Header />
            <button
              onClick={() => navigate('/billing')}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Pricing</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>
    </div>
  );
};