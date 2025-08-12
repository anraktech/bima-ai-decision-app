interface GroqResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Latest)', maxTokens: 131072 },
  { id: 'llama-3.2-90b-vision-preview', displayName: 'Llama 3.2 90B Vision', maxTokens: 131072 },
  { id: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant', maxTokens: 131072 },
  { id: 'gemma2-9b-it', displayName: 'Gemma 2 9B', maxTokens: 8192 },
];

export async function generateGroqResponse(
  modelId: string,
  systemInstructions: string,
  messageHistory: Array<{ content: string; sender: string }>,
  baseModel?: string
): Promise<GroqResponse> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const messages = [
    { role: 'system', content: systemInstructions },
    ...messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))
  ];

  // Ensure the last message is from user
  if (messages.length > 1 && messages[messages.length - 1].role === 'assistant') {
    messages.push({
      role: 'user',
      content: 'Please continue the conversation.'
    });
  }

  const response = await fetch('${API_URL}/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      provider: 'groq',
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
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined
  };
}