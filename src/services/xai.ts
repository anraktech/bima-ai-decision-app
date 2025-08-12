interface XAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const XAI_MODELS = [
  { id: 'grok-2-1212', displayName: 'Grok 2 (Dec 2024)', maxTokens: 131072 },
  { id: 'grok-2-vision-1212', displayName: 'Grok 2 Vision (Dec 2024)', maxTokens: 32768 },
  { id: 'grok-beta', displayName: 'Grok Beta', maxTokens: 131072 },
];

export async function generateXAIResponse(
  modelId: string,
  systemInstructions: string,
  messageHistory: Array<{ content: string; sender: string }>,
  baseModel?: string
): Promise<XAIResponse> {

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

  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch('${API_URL}/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      provider: 'xai',
      model: baseModel || modelId,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`XAI API error: ${error}`);
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