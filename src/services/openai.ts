import OpenAI from 'openai';
import { API_URL } from '../config/api';

// Initialize OpenAI client only if API key is available
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || 'dummy-key-for-backend-only';
const openai = new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Only for demo purposes - in production, use a backend
});

export interface OpenAIModel {
  id: string;
  name: string;
  displayName: string;
  maxTokens: number;
  costPer1kTokens: number;
}

export const OPENAI_MODELS: OpenAIModel[] = [
  {
    id: 'o1',
    name: 'o1',
    displayName: 'o1 (Advanced Reasoning)',
    maxTokens: 200000,
    costPer1kTokens: 0.015
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    displayName: 'o1 Mini (Fast Reasoning)',
    maxTokens: 128000,
    costPer1kTokens: 0.003
  },
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o (Latest)',
    maxTokens: 128000,
    costPer1kTokens: 0.005
  },
  {
    id: 'gpt-4o-mini',
    name: 'gpt-4o-mini', 
    displayName: 'GPT-4o Mini',
    maxTokens: 128000,
    costPer1kTokens: 0.00015
  },
  {
    id: 'gpt-4-turbo',
    name: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxTokens: 128000,
    costPer1kTokens: 0.01
  },
  {
    id: 'gpt-4',
    name: 'gpt-4',
    displayName: 'GPT-4',
    maxTokens: 8192,
    costPer1kTokens: 0.03
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 16385,
    costPer1kTokens: 0.0005
  }
];

// Fetch knowledge base documents for custom models
const fetchKnowledgeBase = async (customModelId: string, token?: string) => {
  if (!customModelId.startsWith('custom-') || !token) {
    return null;
  }
  
  try {
    const modelDbId = customModelId.replace('custom-', '');
    const response = await fetch(`${API_URL}/api/models/${modelDbId}/documents/content`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const documents = await response.json();
      return documents;
    }
  } catch (error) {
    console.error('Failed to fetch knowledge base:', error);
  }
  
  return null;
};

export interface OpenAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const generateOpenAIResponse = async (
  modelId: string,
  systemInstructions: string,
  messages: { content: string; sender: string }[],
  baseModel?: string, // For custom models
  apiToken?: string // For fetching knowledge base
): Promise<OpenAIResponse> => {
  try {
    // If it's a custom model, use the baseModel, otherwise find the standard model
    let actualModelId = modelId;
    if (baseModel && modelId.startsWith('custom-')) {
      actualModelId = baseModel;
    }
    
    const model = OPENAI_MODELS.find(m => m.id === actualModelId);
    if (!model) {
      throw new Error(`Model ${actualModelId} not found`);
    }

    // Enhanced system instructions with knowledge base for custom models
    let enhancedSystemInstructions = systemInstructions;
    
    if (modelId.startsWith('custom-') && apiToken) {
      const knowledgeBase = await fetchKnowledgeBase(modelId, apiToken);
      if (knowledgeBase && knowledgeBase.length > 0) {
        const documentsContext = knowledgeBase.map((doc: any, index: number) => 
          `Document ${index + 1} (${doc.original_name}):\n${doc.content}\n`
        ).join('\n---\n\n');
        
        enhancedSystemInstructions = `${systemInstructions}

KNOWLEDGE BASE:
You have access to the following documents as your knowledge base. Reference them when relevant to provide accurate, informed responses:

${documentsContext}

When referencing information from these documents, mention the document name in your response for transparency.`;
      }
    }

    // Build conversation history
    let conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[];
    
    // o1 models don't support system messages, so we need to handle them differently
    if (model.id === 'o1' || model.id === 'o1-mini') {
      // For o1 models, include system instructions as the first user message
      conversationMessages = [
        { 
          role: 'user' as const, 
          content: `Instructions: ${enhancedSystemInstructions}\n\nConversation context:\n` +
            messages.map(msg => 
              `${msg.sender === 'model-a' ? 'Primary Agent' : msg.sender === 'model-b' ? 'Alternative Agent' : 'User'}: ${msg.content}`
            ).join('\n\n')
        }
      ];
    } else {
      // For other models, use system message normally
      conversationMessages = [
        { role: 'system', content: enhancedSystemInstructions },
        ...messages.map(msg => ({
          role: 'user' as const,
          content: `Previous message from ${msg.sender === 'model-a' ? 'Primary Agent' : msg.sender === 'model-b' ? 'Alternative Agent' : 'User'}: ${msg.content}`
        }))
      ];
    }

    // Call our backend instead of OpenAI directly
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: model.name,
        messages: conversationMessages,
        max_tokens: Math.min(4000, model.maxTokens),
        temperature: model.id === 'o1' || model.id === 'o1-mini' ? 1 : 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const completion = await response.json();

    return {
      content: completion.choices[0]?.message?.content || 'No response generated',
      usage: completion.usage ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      } : undefined
    };
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to generate AI response. Please check your API key and try again.');
  }
};

export const validateOpenAIApiKey = async (): Promise<boolean> => {
  try {
    await openai.models.list();
    return true;
  } catch {
    return false;
  }
};