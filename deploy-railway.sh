#!/bin/bash

# Railway deployment script
echo "🚂 Deploying to Railway..."

# Set the Railway token
export RAILWAY_TOKEN=4e5caf6e-03eb-4578-a5e9-0558dced4f73

# Try to deploy
echo "Attempting deployment..."
railway up

# If that fails, you might need to specify a service
# Uncomment and modify the line below if needed:
# railway up --service your-service-name

echo "✅ Deployment command completed!"
echo ""
echo "⚠️  IMPORTANT: After deployment, update these in Railway dashboard:"
echo "1. STRIPE_STARTER_PRICE_ID (from Stripe products)"
echo "2. STRIPE_PROFESSIONAL_PRICE_ID (from Stripe products)"
echo "3. STRIPE_ENTERPRISE_PRICE_ID (from Stripe products)"
echo "4. STRIPE_WEBHOOK_SECRET (from Stripe webhook setup)"
echo ""
echo "📝 See STRIPE_PRODUCTS_SETUP.md for detailed instructions"