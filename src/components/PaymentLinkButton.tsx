import { getPaymentLink } from '../config/stripe-links';
import { useAuth } from '../contexts/AuthContext';

interface PaymentLinkButtonProps {
  planType: string;
  planName: string;
  planPrice: number;
}

export const PaymentLinkButton: React.FC<PaymentLinkButtonProps> = ({
  planType,
  planName,
  planPrice
}) => {
  const { user } = useAuth();
  
  const handleClick = () => {
    // Get the payment link for this plan
    const basePaymentLink = getPaymentLink(planType);
    
    // Add user tracking with client_reference_id
    const userId = user?.id || 'guest';
    const userEmail = user?.email || '';
    
    // Build the payment link with tracking parameters
    const paymentLink = `${basePaymentLink}?client_reference_id=${userId}&prefilled_email=${encodeURIComponent(userEmail)}`;
    
    console.log('=== PAYMENT LINK DEBUG ===');
    console.log('Plan Type:', planType);
    console.log('Base Payment Link:', basePaymentLink);
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('Final Payment Link:', paymentLink);
    console.log('Redirecting to Stripe Payment Link NOW...');
    
    // Simply redirect to Stripe's payment link
    // No API calls, no complex integration, just a redirect!
    window.location.href = paymentLink;
  };

  return (
    <button
      onClick={handleClick}
      className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all"
    >
      Pay ${planPrice}/month with Stripe
    </button>
  );
};