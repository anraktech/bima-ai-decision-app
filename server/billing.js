import express from 'express';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const router = express.Router();

// Middleware to verify user authentication
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];
  // In a real app, verify the JWT token and get user info
  // For now, we'll mock it
  req.user = { 
    id: 'user_123', 
    email: 'user@example.com',
    name: 'Test User'
  };
  next();
};

// Create a new subscription
router.post('/create-subscription', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { priceId, paymentMethodId, billingCycle } = req.body;
    const { user } = req;

    if (!priceId || !paymentMethodId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Create or retrieve customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user.id,
          },
        });
      }
    } catch (error) {
      console.error('Customer creation/retrieval error:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Attach payment method to customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      console.error('Payment method attachment error:', error);
      return res.status(500).json({ error: 'Failed to attach payment method' });
    }

    // Create subscription
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: priceId,
          },
        ],
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user.id,
          billingCycle: billingCycle,
        },
      });

      // Handle the response based on subscription status
      let responseData = {
        subscriptionId: subscription.id,
        clientSecret: null,
        status: subscription.status,
      };

      if (subscription.status === 'incomplete') {
        responseData.clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      }

      // In a real app, save subscription info to your database here
      console.log('Subscription created:', subscription.id);

      res.json(responseData);
    } catch (error) {
      console.error('Subscription creation error:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }
  } catch (error) {
    console.error('General subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscription ID' });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({ 
      success: true, 
      subscription: {
        id: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
      }
    });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
router.post('/reactivate-subscription', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscription ID' });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    res.json({ 
      success: true, 
      subscription: {
        id: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    });
  } catch (error) {
    console.error('Subscription reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Get billing portal session
router.post('/create-portal-session', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { user } = req;
    
    // Find customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/billing`,
    });

    res.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      console.log('Subscription created:', event.data.object);
      // Update your database with new subscription
      break;
      
    case 'customer.subscription.updated':
      console.log('Subscription updated:', event.data.object);
      // Update subscription status in your database
      break;
      
    case 'customer.subscription.deleted':
      console.log('Subscription cancelled:', event.data.object);
      // Handle subscription cancellation
      break;
      
    case 'invoice.payment_succeeded':
      console.log('Payment succeeded:', event.data.object);
      // Update user's billing status, reset usage counters, etc.
      break;
      
    case 'invoice.payment_failed':
      console.log('Payment failed:', event.data.object);
      // Handle failed payment, notify user, etc.
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Get user's subscription info
router.get('/subscription', authenticateUser, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  try {
    const { user } = req;

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.json({ 
        subscription: null,
        customer: null 
      });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
    });

    const subscription = subscriptions.data.length > 0 ? subscriptions.data[0] : null;

    res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        priceId: subscription.items.data[0].price.id,
        amount: subscription.items.data[0].price.unit_amount,
      } : null,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription info' });
  }
});

export default router;