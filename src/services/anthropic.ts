import { API_URL } from '../config/api';

interface AnthropicResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', maxTokens: 8192 },
];

export async function generateAnthropicResponse(
  modelId: string,
  systemInstructions: string,
  messageHistory: Array<{ content: string; sender: string }>,
  baseModel?: string
): Promise<AnthropicResponse> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  // Format messages for Anthropic - system message handled separately by backend
  const messages = [
    { role: 'system', content: systemInstructions },
    ...messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
  ];

  // If the last message is from assistant, add a user message to prompt response
  if (messages.length > 1 && messages[messages.length - 1].role === 'assistant') {
    messages.push({
      role: 'user',
      content: 'Please continue the conversation.'
    });
  }

  const response = await fetch(`${API_URL}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      provider: 'anthropic',
      model: baseModel || modelId,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Backend API error: ${error}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices[0].message.content,
    usage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || data.usage.input_tokens,
      completion_tokens: data.usage.completion_tokens || data.usage.output_tokens,
      total_tokens: data.usage.total_tokens || (data.usage.input_tokens + data.usage.output_tokens)
    } : undefined
  };
}