import nodemailer from 'nodemailer';

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'anraktech@gmail.com',
    pass: 'pwfj baky coby imxd' // App password
  }
});

// Send admin notification email
async function sendAdminNotification(userEmail, planType, amountPaid) {
  const mailOptions = {
    from: 'ANRAK Platform <anraktech@gmail.com>',
    to: 'anraktech@gmail.com', // Admin email
    subject: `🎉 New Subscription: ${planType.toUpperCase()} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">New Subscription Alert!</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Customer Details:</h2>
          <div style="background: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
            <p style="margin: 10px 0;"><strong>Email:</strong> ${userEmail}</p>
            <p style="margin: 10px 0;"><strong>Plan:</strong> ${planType.toUpperCase()}</p>
            <p style="margin: 10px 0;"><strong>Amount:</strong> $${(amountPaid / 100).toFixed(2)}</p>
            <p style="margin: 10px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 5px;">
            <p style="margin: 0; color: #2e7d32;">✅ Payment successfully processed via Stripe</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Admin notification sent successfully');
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}

// Send welcome email to customer
async function sendWelcomeEmail(userEmail, userName, planType) {
  const planDetails = {
    starter: {
      name: 'Starter',
      tokens: '750,000',
      price: '$10/month',
      features: [
        '750,000 tokens per month',
        'All AI models available',
        'Priority processing',
        'Advanced analytics',
        'API access',
        'Priority support'
      ]
    },
    enterprise: {
      name: 'Enterprise',
      tokens: 'Unlimited',
      price: '$500 one-time',
      features: [
        'Bring your own API keys',
        'Unlimited tokens',
        'White-label options',
        'Source code access',
        'Lifetime updates',
        'Dedicated support'
      ]
    }
  };

  const plan = planDetails[planType] || planDetails.starter;

  const mailOptions = {
    from: 'ANRAK Platform <anraktech@gmail.com>',
    to: userEmail,
    subject: `Welcome to ANRAK ${plan.name} Plan! 🚀`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center;">
          <img src="https://anrak.tech/anrak-logo.png" alt="ANRAK" style="height: 60px; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0;">Welcome to ANRAK!</h1>
        </div>
        
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Hi ${userName || 'there'}! 👋</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for subscribing to the <strong>${plan.name} Plan</strong>! 
            Your account has been upgraded and you now have access to all premium features.
          </p>
          
          <div style="background: white; padding: 25px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #ff6b35; margin-top: 0;">Your Plan Details:</h3>
            <div style="border-left: 4px solid #ff6b35; padding-left: 15px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan.name}</p>
              <p style="margin: 5px 0;"><strong>Tokens:</strong> ${plan.tokens}</p>
              <p style="margin: 5px 0;"><strong>Price:</strong> ${plan.price}</p>
            </div>
            
            <h4 style="color: #333; margin-top: 25px;">Included Features:</h4>
            <ul style="color: #666; line-height: 1.8;">
              ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
          
          <div style="background: #fff3e0; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #e65100; margin-top: 0;">🚀 Getting Started:</h3>
            <ol style="color: #666; line-height: 1.8;">
              <li>Visit <a href="https://anrak.tech/dashboard" style="color: #ff6b35;">your dashboard</a></li>
              <li>Select AI models for your agents</li>
              <li>Start creating powerful AI conversations</li>
              <li>Track your usage in the billing section</li>
            </ol>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Need Help?</h3>
            <p style="color: #666; line-height: 1.6;">
              Our support team is here to help you get the most out of ANRAK.
            </p>
            <ul style="color: #666; line-height: 1.8;">
              <li>Email: <a href="mailto:kapil@anrak.io" style="color: #ff6b35;">kapil@anrak.io</a></li>
              <li>Documentation: <a href="https://anrak.tech/docs" style="color: #ff6b35;">anrak.tech/docs</a></li>
            </ul>
          </div>
          
          ${planType === 'enterprise' ? `
          <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin-top: 0;">🎉 Enterprise Benefits:</h3>
            <p style="color: #1b5e20; line-height: 1.6;">
              As an Enterprise customer, you'll receive instructions for:
            </p>
            <ul style="color: #2e7d32; line-height: 1.8;">
              <li>Setting up your own API keys</li>
              <li>White-label configuration</li>
              <li>Source code access</li>
            </ul>
            <p style="color: #1b5e20; line-height: 1.6;">
              We'll reach out within 24 hours with your setup guide.
            </p>
          </div>
          ` : ''}
        </div>
        
        <div style="background: #333; padding: 20px; text-align: center;">
          <p style="color: #999; margin: 0; font-size: 14px;">
            © 2025 ANRAK. All rights reserved.
          </p>
          <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">
            You're receiving this email because you subscribed to ANRAK.
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}

// Test email configuration
async function testEmailConfiguration() {
  try {
    await transporter.verify();
    console.log('✅ Email service configured successfully');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration failed:', error);
    return false;
  }
}

export {
  sendAdminNotification,
  sendWelcomeEmail,
  testEmailConfiguration
};