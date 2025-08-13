import { API_URL } from '../config/api';

interface GoogleResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const GOOGLE_MODELS = [
  { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', maxTokens: 8192 },
  { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', maxTokens: 8192 },
  { id: 'gemini-1.5-flash-8b', displayName: 'Gemini 1.5 Flash 8B', maxTokens: 8192 },
];

export async function generateGoogleResponse(
  modelId: string,
  systemInstructions: string,
  messageHistory: Array<{ content: string; sender: string }>,
  baseModel?: string
): Promise<GoogleResponse> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  // Format messages for the backend - it will handle Google's specific format
  const messages = [
    { role: 'system', content: systemInstructions },
    ...messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
  ];

  // Ensure the conversation ends with a user message
  if (messages.length > 1 && messages[messages.length - 1].role === 'assistant') {
    messages.push({
      role: 'user',
      content: 'Please continue.'
    });
  }

  const response = await fetch(`${API_URL}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      provider: 'google',
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
      prompt_tokens: data.usage.prompt_tokens || data.usage.promptTokenCount || 0,
      completion_tokens: data.usage.completion_tokens || data.usage.candidatesTokenCount || 0,
      total_tokens: data.usage.total_tokens || data.usage.totalTokenCount || 0
    } : undefined
  };
}