// Stripe Payment Links - The simplest solution!
// These are your LIVE payment links from Stripe Dashboard

export const STRIPE_PAYMENT_LINKS = {
  starter: 'https://buy.stripe.com/6oUeVdgEdchp5MX3ed3cc00',
  professional: 'https://buy.stripe.com/6oUcN5bjTepx4IT4ih3cc01', 
  enterprise: 'https://buy.stripe.com/3cI5kDgEd6X5fnx8yx3cc02'
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