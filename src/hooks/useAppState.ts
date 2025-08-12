import { useState, useCallback, useEffect, useMemo } from 'react';
import type { AppState, ConversationPanel, Message, AIModel } from '../types';
import { generateOpenAIResponse, OPENAI_MODELS } from '../services/openai';
import { generateAnthropicResponse, ANTHROPIC_MODELS } from '../services/anthropic';
import { generateGoogleResponse, GOOGLE_MODELS } from '../services/google';
import { generateGroqResponse, GROQ_MODELS } from '../services/groq';
import { generateXAIResponse, XAI_MODELS } from '../services/xai';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';

// Perplexity removed - models not working properly
import { generateDeepseekResponse } from '../services/deepseek';
import { useAuth } from '../contexts/AuthContext';

const initialState: AppState = {
  panelA: {
    id: 'model-a',
    model: null,
    systemInstructions: '',
    initialMessage: '',
  },
  panelB: {
    id: 'model-b',
    model: null,
    systemInstructions: '',
    initialMessage: '',
  },
  conversation: {
    messages: [],
    messageCount: 0,
    isActive: false,
    isWaitingForIntervention: false,
    interventionCount: 0,
  },
  isSetupComplete: false,
};

export const useAppState = () => {
  const [state, setState] = useState<AppState>(initialState);
  const { token } = useAuth();


  const setModel = useCallback((panelId: 'model-a' | 'model-b', model: AIModel) => {
    setState(prev => ({
      ...prev,
      [panelId === 'model-a' ? 'panelA' : 'panelB']: {
        ...prev[panelId === 'model-a' ? 'panelA' : 'panelB'],
        model,
      },
    }));
  }, []);

  const setSystemInstructions = useCallback((panelId: 'model-a' | 'model-b', instructions: string) => {
    setState(prev => ({
      ...prev,
      [panelId === 'model-a' ? 'panelA' : 'panelB']: {
        ...prev[panelId === 'model-a' ? 'panelA' : 'panelB'],
        systemInstructions: instructions,
      },
    }));
  }, []);

  const setInitialMessage = useCallback((panelId: 'model-a' | 'model-b', message: string) => {
    setState(prev => ({
      ...prev,
      [panelId === 'model-a' ? 'panelA' : 'panelB']: {
        ...prev[panelId === 'model-a' ? 'panelA' : 'panelB'],
        initialMessage: message,
      },
    }));
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setState(prev => {
      const newMessageCount = prev.conversation.messageCount + 1;
      const isWaitingForIntervention = newMessageCount % 10 === 0;
      
      return {
        ...prev,
        conversation: {
          ...prev.conversation,
          messages: [...prev.conversation.messages, newMessage],
          messageCount: newMessageCount,
          isWaitingForIntervention,
          interventionCount: isWaitingForIntervention 
            ? prev.conversation.interventionCount + 1 
            : prev.conversation.interventionCount,
        },
      };
    });
  }, []);

  const startConversation = useCallback((startingAgent: 'model-a' | 'model-b', initialMessage: string, multiplayerConfig?: any) => {
    setState(prev => {
      const isSetupComplete = prev.panelA.model && prev.panelB.model && 
                             prev.panelA.systemInstructions && prev.panelB.systemInstructions &&
                             initialMessage.trim();
      
      if (!isSetupComplete) return prev;
      
      // Add default system instructions for AI-to-AI conversation context
      const defaultSystemInstruction = "You are talking to another AI bot, you have to follow system instructions and give your best, listen carefully and answer confidently. Make your point come across forward and never feel shy to step up the conversation, your job is to make the conversation entertaining and flow, whatever topic and role you are assigned go deep, have no fear you have to act extremely professional, it should not come across that you are just an AI model. ";
      
      // Add opening conversation context to system instructions
      const enhancedSystemInstructionsA = prev.panelA.systemInstructions + `\n\n${defaultSystemInstruction}Your opening line is: "${initialMessage}"`;
      const enhancedSystemInstructionsB = prev.panelB.systemInstructions + `\n\n${defaultSystemInstruction}The conversation will start with the other agent saying: "${initialMessage}"`;
      
      // Update the state with enhanced system instructions
      const updatedPanelA = {
        ...prev.panelA,
        systemInstructions: enhancedSystemInstructionsA
      };
      const updatedPanelB = {
        ...prev.panelB,
        systemInstructions: enhancedSystemInstructionsB
      };

      // Generate conversation ID
      const conversationId = crypto.randomUUID();
      
      // Track conversation start in backend
      const token = localStorage.getItem('token');
      if (token) {
        fetch('${API_URL}/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            id: conversationId,
            title: initialMessage.substring(0, 100),
            modelA: prev.panelA.model?.displayName,
            modelB: prev.panelB.model?.displayName
          })
        }).catch(error => {
          console.error('Failed to create conversation:', error);
        });
      }
      
      // Add initial message from the selected starting agent
      const firstMessage: Message = {
        id: crypto.randomUUID(),
        content: initialMessage,
        sender: startingAgent,
        timestamp: new Date(),
      };

      return {
        ...prev,
        panelA: updatedPanelA,
        panelB: updatedPanelB,
        conversation: {
          ...prev.conversation,
          id: conversationId,
          messages: [firstMessage],
          messageCount: 1,
          isActive: true,
          multiplayerConfig,
          isPublicViewable: multiplayerConfig?.isPublicViewable || false,
        },
        isSetupComplete: true,
      };
    });
  }, []);

  const continueConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      conversation: {
        ...prev.conversation,
        isWaitingForIntervention: false,
      },
    }));
  }, []);

  const addUserIntervention = useCallback((intervention: string, targetAgent?: 'model-a' | 'model-b') => {
    // Add the intervention message as the selected agent, not as user
    addMessage({
      content: intervention,
      sender: targetAgent || 'model-b', // Post as the selected agent
    });
    
    // Continue conversation from the OTHER agent (opposite of who just "spoke")
    const nextResponder = targetAgent === 'model-a' ? 'model-b' : 'model-a';
    
    setState(prev => ({
      ...prev,
      conversation: {
        ...prev.conversation,
        isWaitingForIntervention: false,
        nextResponder // The opposite agent responds next
      },
    }));
  }, [addMessage]);

  const resetConversation = useCallback(() => {
    setState(initialState);
  }, []);

  // Effect to handle AI responses
  useEffect(() => {
    const handleAIResponse = async () => {
      if (!state.conversation.isActive || 
          state.conversation.isWaitingForIntervention ||
          state.conversation.messages.length === 0) {
        return;
      }

      const lastMessage = state.conversation.messages[state.conversation.messages.length - 1];
      const messageHistory = state.conversation.messages.map(m => ({ content: m.content, sender: m.sender }));

      // Determine which AI should respond next and capture panel data immediately
      let nextSender: 'model-a' | 'model-b';
      let activePanel: ConversationPanel;
      
      if (lastMessage.sender === 'model-a') {
        nextSender = 'model-b';
        activePanel = { ...state.panelB }; // Create a copy to prevent stale closure
      } else if (lastMessage.sender === 'model-b') {
        nextSender = 'model-a';
        activePanel = { ...state.panelA }; // Create a copy to prevent stale closure
      } else {
        // User intervened, use the nextResponder field if set, otherwise default to model-b
        nextSender = state.conversation.nextResponder || 'model-b';
        activePanel = nextSender === 'model-a' ? { ...state.panelA } : { ...state.panelB };
      }

      if (!activePanel.model) return;

      try {
        let responseContent: string;
        let tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
        
        // Determine which AI service to use based on the model
        const modelId = activePanel.model?.id || '';
        const provider = activePanel.model?.provider || '';
        
        console.log('Making API call for model:', activePanel.model?.displayName, 'Provider:', provider, 'ModelID:', modelId);
        
        // Check if it's a custom model and get its base model
        if (activePanel.model?.isCustom && activePanel.model?.baseModel) {
          // For custom models, use the base model's provider
          const baseModelId = activePanel.model.baseModel;
          if (OPENAI_MODELS.some(m => m.id === baseModelId)) {
            const apiResponse = await generateOpenAIResponse(
              activePanel.model.id,
              activePanel.systemInstructions,
              messageHistory,
              activePanel.model.baseModel,
              token || undefined
            );
            responseContent = apiResponse.content;
            tokenUsage = apiResponse.usage;
          } else {
            responseContent = `[${activePanel.model?.displayName || 'AI Model'}]: Custom model with unsupported base model.`;
          }
        } else if (provider === 'anthropic') {
          const apiResponse = await generateAnthropicResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage;
        } else if (provider === 'google') {
          const apiResponse = await generateGoogleResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage;
        // Perplexity case removed - models not working properly
        } else if (provider === 'groq') {
          const apiResponse = await generateGroqResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage;
        } else if (provider === 'xai') {
          const apiResponse = await generateXAIResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage;
        } else if (provider === 'deepseek') {
          const apiResponse = await generateDeepseekResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage ? {
            prompt_tokens: apiResponse.usage.promptTokens,
            completion_tokens: apiResponse.usage.completionTokens,
            total_tokens: apiResponse.usage.totalTokens
          } : undefined;
        } else if (provider === 'openai') {
          const apiResponse = await generateOpenAIResponse(
            modelId,
            activePanel.systemInstructions,
            messageHistory,
            undefined,
            token || undefined
          );
          responseContent = apiResponse.content;
          tokenUsage = apiResponse.usage;
        } else {
          // Fallback for unknown models
          responseContent = `[${activePanel.model?.displayName || 'AI Model'}]: This model provider is not yet configured.`;
        }
        
        console.log('API Response received. Content length:', responseContent?.length || 0, 'Content preview:', responseContent?.substring(0, 100));
        
        // Store token usage
        if (tokenUsage) {
          console.log('Token usage for', activePanel.model?.id, ':', tokenUsage);
          const authToken = localStorage.getItem('token');
          if (authToken) {
            fetch('${API_URL}/api/usage/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                modelId: activePanel.model?.id,
                modelName: activePanel.model?.displayName || activePanel.model?.id,
                promptTokens: tokenUsage.prompt_tokens,
                completionTokens: tokenUsage.completion_tokens,
                totalTokens: tokenUsage.total_tokens,
                conversationId: state.conversation.id || undefined
              })
            }).catch(error => {
              console.error('Failed to track usage:', error);
            });
          }
        }

        // Only add the response if the conversation is still active
        setState(current => {
          if (current.conversation.isActive && !current.conversation.isWaitingForIntervention) {
            const newMessageCount = current.conversation.messageCount + 1;
            const isWaitingForIntervention = newMessageCount % 10 === 0;
            
            const newMessage: Message = {
              id: crypto.randomUUID(),
              content: responseContent,
              sender: nextSender,
              timestamp: new Date(),
            };

            return {
              ...current,
              conversation: {
                ...current.conversation,
                messages: [...current.conversation.messages, newMessage],
                messageCount: newMessageCount,
                isWaitingForIntervention,
                interventionCount: isWaitingForIntervention 
                  ? current.conversation.interventionCount + 1 
                  : current.conversation.interventionCount,
                nextResponder: undefined, // Clear the nextResponder after use
              },
            };
          }
          return current;
        });
      } catch (error) {
        console.error('Error generating AI response:', error);
        
        // Add error message to conversation so user can see what went wrong
        setState(current => {
          if (current.conversation.isActive) {
            const errorMessage: Message = {
              id: crypto.randomUUID(),
              content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response from AI'}`,
              sender: nextSender,
              timestamp: new Date(),
            };

            return {
              ...current,
              conversation: {
                ...current.conversation,
                messages: [...current.conversation.messages, errorMessage],
                messageCount: current.conversation.messageCount + 1,
              },
            };
          }
          return current;
        });
      }
    };

    // Quick delay before AI responds
    const timeoutId = setTimeout(handleAIResponse, 500);
    return () => clearTimeout(timeoutId);
  }, [state.conversation.messages, state.conversation.isActive, state.conversation.isWaitingForIntervention]);

  const actions = useMemo(() => ({
    setModel,
    setSystemInstructions,
    setInitialMessage,
    addMessage,
    startConversation,
    continueConversation,
    addUserIntervention,
    resetConversation,
  }), [setModel, setSystemInstructions, setInitialMessage, addMessage, startConversation, continueConversation, addUserIntervention, resetConversation]);

  const memoizedState = useMemo(() => state, [
    state.panelA.id, state.panelA.model, state.panelA.systemInstructions, state.panelA.initialMessage,
    state.panelB.id, state.panelB.model, state.panelB.systemInstructions, state.panelB.initialMessage,
    state.conversation, state.isSetupComplete
  ]);

  return {
    state: memoizedState,
    actions,
  };
};