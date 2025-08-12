interface DeepseekResponse {
  content: string;
  finishReason: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export const generateDeepseekResponse = async (
  modelId: string,
  systemInstructions: string,
  messageHistory: Array<{ content: string; sender: string }>,
  userInput?: string
): Promise<DeepseekResponse> => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    // Format messages for Deepseek API (OpenAI-compatible)
    const messages = [
      { role: 'system', content: systemInstructions },
      ...messageHistory.map(msg => ({
        role: msg.sender.includes('user') || msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      ...(userInput ? [{ role: 'user', content: userInput }] : [])
    ];

    const response = await fetch('${API_URL}/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider: 'deepseek',
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepseek API error:', response.status, errorText);
      throw new Error(`Deepseek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response generated from Deepseek');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || '';
    
    // Calculate cost (estimated pricing)
    const tokenUsage = data.usage || {};
    const promptTokens = tokenUsage.prompt_tokens || 0;
    const completionTokens = tokenUsage.completion_tokens || 0;
    const totalTokens = tokenUsage.total_tokens || promptTokens + completionTokens;
    
    // Deepseek pricing (estimated - adjust based on actual pricing)
    const costPerInputToken = 0.00014 / 1000; // $0.14 per 1M input tokens
    const costPerOutputToken = 0.00028 / 1000; // $0.28 per 1M output tokens
    const cost = (promptTokens * costPerInputToken) + (completionTokens * costPerOutputToken);

    return {
      content: content.trim(),
      finishReason: choice.finish_reason || 'stop',
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      cost
    };

  } catch (error) {
    console.error('Error calling Deepseek API:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate response from Deepseek');
  }
};