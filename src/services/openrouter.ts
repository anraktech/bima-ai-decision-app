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
    
    if (error.details?.includes('model') || error.details?.includes('not available')) {
      throw new Error(`OpenRouter model error: ${error.details || 'Model not available'}`);
    } else if (error.details?.includes('key') || error.details?.includes('API')) {
      throw new Error('OpenRouter API key error: Please check your API key configuration');
    } else if (error.details?.includes('rate limit') || error.details?.includes('quota')) {
      throw new Error('OpenRouter rate limit exceeded. Please try again later.');
    }
    
    throw new Error(error.details || error.error || 'Failed to generate response from OpenRouter');
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || 'No response generated',
    usage: data.usage
  };
}