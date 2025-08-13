import { API_URL } from '../config/api';

interface OpenRouterResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function generateOpenRouterResponse(
  modelId: string,
  systemInstructions?: string,
  conversationHistory?: { role: string; content: string }[],
  baseModel?: string,
  userInput?: string,
  token?: string
): Promise<OpenRouterResponse> {
  const authToken = token || localStorage.getItem('token');
  
  if (!authToken) {
    throw new Error('Authentication required');
  }

  // Build messages array for OpenRouter
  const messages = [
    ...(systemInstructions ? [{ 
      role: 'system', 
      content: systemInstructions 
    }] : []),
    ...(conversationHistory || []).map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    ...(userInput ? [{ role: 'user', content: userInput }] : [])
  ];

  // Ensure we have at least one message
  if (messages.length === 0 || (messages.length === 1 && messages[0].role === 'system')) {
    messages.push({
      role: 'user',
      content: 'Please begin the conversation.'
    });
  }

  const response = await fetch(`${API_URL}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      provider: 'openrouter',
      model: baseModel || modelId,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: 'Failed to generate response' 
    }));
    
    // Handle specific OpenRouter errors
    if (response.status === 429) {
      // Extract wait time if available
      const errorMsg = error.error || error.message || '';
      if (errorMsg.includes('limited to 1 request')) {
        throw new Error('⏳ Free model rate limit: This free model is limited to 1 request per minute. Please wait 60 seconds or try a paid model.');
      }
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    } else if (response.status === 400) {
      if (error.error?.includes('model_not_found') || error.error?.includes('not available')) {
        throw new Error(`Model temporarily unavailable. Try another model or check back later.`);
      }
      throw new Error(error.error || 'Invalid request. Please try a different model.');
    } else if (response.status === 401) {
      throw new Error('API authentication error. Please check your configuration.');
    }
    
    throw new Error(error.error || error.message || 'Failed to generate response');
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || 'No response generated',
    usage: data.usage
  };
}