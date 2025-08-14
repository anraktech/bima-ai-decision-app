import { useState } from 'react';
import { X, CreditCard, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planType: string;
  planName: string;
  planPrice: number;
  onSuccess: () => void;
}

interface CheckoutFormProps {
  planType: string;
  planName: string;
  planPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  planType,
  planName,
  planPrice,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleStripeCheckout = async () => {
    if (!user) {
      setErrorMessage('Please log in to continue');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // Create checkout session
      const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planType,
          userEmail: user.email,
          userName: user.name,
          userId: user.id,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create checkout session: ${errorData}`);
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start checkout');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-700">{errorMessage}</span>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Plan:</span>
          <span className="font-medium">{planName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Amount:</span>
          <span className="font-bold text-lg">${planPrice}</span>
        </div>
      </div>

      {/* Information about Stripe Checkout */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Secure Stripe Checkout</h4>
            <p className="text-sm text-blue-700 mt-1">
              You'll be redirected to Stripe's secure payment page to complete your purchase. Coupon codes can be applied during checkout.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          onClick={handleStripeCheckout}
          disabled={isProcessing}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <ExternalLink className="w-4 h-4" />
              <span>Pay ${planPrice}</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Your payment is secured by Stripe. You can cancel anytime.
      </p>
    </div>
  );
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  planType,
  planName,
  planPrice,
  onSuccess
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-150 scale-100 opacity-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Upgrade to {planName}
              </h3>
              <p className="text-sm text-gray-500">
                Secure payment powered by Stripe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <CheckoutForm
            planType={planType}
            planName={planName}
            planPrice={planPrice}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
};