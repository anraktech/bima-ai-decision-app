#!/bin/bash

# Script to add Vercel environment variables
TOKEN="gQLt15cEMCyf1fgBWyUrzQCc"

echo "Adding Stripe publishable key..."
echo "pk_live_51RvntgGsx0aBXRni4t9w9OpqhhLYewLFLlSVetKEo5XOabAa3BoQvtj0Lp1NaAZ3ZjnAf3vIl3m5bPvCqL6cYP1f00LczSmQtP" | npx vercel env add --token "$TOKEN" VITE_STRIPE_PUBLISHABLE_KEY --production