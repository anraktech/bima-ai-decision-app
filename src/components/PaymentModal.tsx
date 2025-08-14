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
  const { user, token } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; couponId?: string; amountOff?: number } | null>(null);
  const [finalPrice, setFinalPrice] = useState(planPrice);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/stripe/validate-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: couponCode })
      });

      if (response.ok) {
        const { valid, discount, couponId, amountOff } = await response.json();
        if (valid) {
          setCouponApplied({ code: couponCode, discount, couponId, amountOff });
          // Calculate final price based on percentage or fixed amount discount
          if (amountOff && amountOff > 0) {
            setFinalPrice(Math.max(0, planPrice - amountOff));
          } else {
            setFinalPrice(Math.max(0, planPrice - (planPrice * discount / 100)));
          }
          setErrorMessage('');
        } else {
          setErrorMessage('Invalid or expired coupon code');
        }
      } else {
        setErrorMessage('Failed to validate coupon code');
      }
    } catch (error) {
      setErrorMessage('Error applying coupon');
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setFinalPrice(planPrice);
    setCouponCode('');
    setErrorMessage('');
  };

  const handleStripeCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage('');

    try {
      // Create checkout session
      const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planType,
          couponCode: couponApplied?.code,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
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
      {/* Coupon Code Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Coupon Code (Optional)
        </label>
        {!couponApplied ? (
          <div className="flex space-x-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={!couponCode.trim() || isProcessing}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-700 font-medium">
                {couponApplied.code} - {couponApplied.discount}% off applied
              </span>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="text-xs text-green-600 hover:text-green-800 underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

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
        {couponApplied ? (
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Original Price:</span>
              <span className="line-through text-gray-400">${planPrice}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Discount ({couponApplied.discount}%):</span>
              <span className="text-green-600">-${(planPrice - finalPrice).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="text-gray-900 font-medium">Total Amount:</span>
              <span className="font-bold text-lg text-green-600">${finalPrice.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Amount:</span>
            <span className="font-bold text-lg">${planPrice}</span>
          </div>
        )}
      </div>

      {/* Information about Stripe Checkout */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Secure Stripe Checkout</h4>
            <p className="text-sm text-blue-700 mt-1">
              You'll be redirected to Stripe's secure payment page to complete your purchase. All major cards accepted.
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
              <span>Pay ${finalPrice.toFixed(2)}</span>
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