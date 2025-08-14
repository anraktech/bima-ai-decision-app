// Stripe Payment Links - The simplest solution!
// Replace these with your actual payment links from Stripe Dashboard

export const STRIPE_PAYMENT_LINKS = {
  starter: 'https://buy.stripe.com/YOUR_STARTER_LINK_HERE',
  professional: 'https://buy.stripe.com/YOUR_PROFESSIONAL_LINK_HERE', 
  enterprise: 'https://buy.stripe.com/YOUR_ENTERPRISE_LINK_HERE'
};

// To get payment links:
// 1. Go to https://dashboard.stripe.com/payment-links
// 2. Click "New" to create a payment link
// 3. Select your product/price
// 4. Configure settings (allow promotion codes, etc.)
// 5. Copy the link and paste it here

export const getPaymentLink = (planType: string): string => {
  const links = STRIPE_PAYMENT_LINKS as Record<string, string>;
  return links[planType] || links.starter;
};