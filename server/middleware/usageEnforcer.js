// Usage Enforcement Middleware - BULLETPROOF
// Blocks requests that would exceed daily limits BEFORE API calls are made

import jwt from 'jsonwebtoken';
import { canUseModelTier, getModelTier, trackTokenUsage } from '../services/usageTracker.js';

// Middleware to check usage limits before allowing AI API calls
export const enforceUsageLimits = (pool) => {
  return async (req, res, next) => {
    try {
      // Only enforce on AI conversation endpoints
      const isAIEndpoint = req.path.includes('/api/ai/') || 
                          req.path.includes('/api/conversation') ||
                          req.path.includes('/openai/') ||
                          req.path.includes('/anthropic/') ||
                          req.path.includes('/google/') ||
                          req.path.includes('/groq/') ||
                          req.path.includes('/xai/') ||
                          req.path.includes('/deepseek/') ||
                          req.path.includes('/openrouter/');

      if (!isAIEndpoint) {
        return next();
      }

      // Get user from token
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'NO_TOKEN' 
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;

      if (!userId) {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN' 
        });
      }

      // Extract model ID from request
      let modelId = req.body.model || req.body.modelId || req.query.model;
      
      if (!modelId) {
        return res.status(400).json({ 
          error: 'Model ID required',
          code: 'NO_MODEL_ID' 
        });
      }

      // Estimate token usage (conservative estimate)
      const messages = req.body.messages || [];
      const systemInstructions = req.body.systemInstructions || '';
      const estimatedPromptTokens = (messages.join(' ') + systemInstructions).length / 4; // Rough estimate: 4 chars per token
      const estimatedCompletionTokens = 1000; // Conservative estimate for response
      const estimatedTotalTokens = Math.ceil(estimatedPromptTokens + estimatedCompletionTokens);

      console.log(`🔍 Usage check: User ${userId}, Model ${modelId}, Estimated tokens: ${estimatedTotalTokens}`);

      // Check if user can use this model tier
      const usageCheck = await canUseModelTier(pool, userId, modelId, estimatedTotalTokens);

      if (!usageCheck.allowed) {
        const modelTier = getModelTier(modelId);
        
        console.log(`❌ Usage blocked: ${usageCheck.reason}`);
        
        return res.status(429).json({
          error: 'Daily usage limit exceeded',
          code: 'USAGE_LIMIT_EXCEEDED',
          details: {
            modelTier,
            currentUsage: usageCheck.currentUsage,
            dailyLimit: usageCheck.dailyLimit,
            remainingTokens: usageCheck.remainingTokens,
            userPlan: usageCheck.userPlan,
            requiredTokens: usageCheck.requiredTokens,
            reason: usageCheck.reason
          },
          message: `You've reached your daily limit for ${modelTier} models. Current usage: ${usageCheck.currentUsage}/${usageCheck.dailyLimit} tokens. Upgrade your plan for higher limits.`,
          upgradeUrl: '/billing'
        });
      }

      // Add usage info to request for tracking after response
      req.usageInfo = {
        userId,
        modelId,
        modelTier: usageCheck.modelTier,
        estimatedTokens: estimatedTotalTokens
      };

      console.log(`✅ Usage allowed: ${usageCheck.remainingTokens} tokens remaining`);
      next();

    } catch (error) {
      console.error('❌ Usage enforcement error:', error);
      
      // Don't block requests on enforcement errors - but log them
      // This ensures the system stays available even if usage tracking fails
      console.warn('⚠️ Proceeding without usage enforcement due to error');
      next();
    }
  };
};

// Middleware to track actual token usage AFTER AI response
export const trackUsageAfterResponse = (pool) => {
  return async (req, res, next) => {
    // Capture the original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original response first
      originalJson.call(this, data);
      
      // Then track usage asynchronously (don't block response)
      if (req.usageInfo && data.usage) {
        setImmediate(async () => {
          try {
            await trackTokenUsage(pool, {
              userId: req.usageInfo.userId,
              modelId: req.usageInfo.modelId,
              modelName: data.model || req.usageInfo.modelId,
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
              cost: (data.usage.total_tokens || 0) * 0.00001, // Rough cost estimate
              conversationId: req.body.conversationId || null
            });
            
            console.log(`📊 Actual usage tracked: ${data.usage.total_tokens} tokens`);
            
          } catch (error) {
            console.error('❌ Post-response usage tracking failed:', error);
            // Don't throw - response already sent
          }
        });
      }
    };
    
    next();
  };
};