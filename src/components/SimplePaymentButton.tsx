import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SimplePaymentButtonProps {
  planType: string;
  planName: string;
  planPrice: number;
  userEmail: string;
  userId: number;
  userName: string;
}

export const SimplePaymentButton: React.FC<SimplePaymentButtonProps> = ({
  planType,
  planName,
  planPrice,
  userEmail,
  userId,
  userName
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    
    // Direct API call without any Stripe.js involvement
    const apiUrl = 'https://bima-ai-decision-app-production.up.railway.app';
    
    try {
      const response = await fetch(`${apiUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planType,
          userEmail,
          userName,
          userId,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Direct redirect - no Stripe.js involved
        window.location.href = data.url;
      } else {
        alert('Error: No checkout URL received. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to create checkout session. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Creating checkout...</span>
        </>
      ) : (
        <span>Pay ${planPrice} for {planName}</span>
      )}
    </button>
  );
};