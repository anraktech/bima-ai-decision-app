export interface Message {
  id: string;
  content: string;
  sender: 'model-a' | 'model-b' | 'user';
  timestamp: Date;
}

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  provider?: string;
  context?: number;
  isCustom?: boolean;
  isShared?: boolean; // For imported models from other users
  baseModel?: string; // For custom models, stores the underlying OpenAI model
  systemInstructions?: string;
  openingStatement?: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  models: AIModel[];
}

export interface ConversationPanel {
  id: 'model-a' | 'model-b';
  model: AIModel | null;
  systemInstructions: string;
  initialMessage: string;
}

export interface ConversationState {
  id?: string;
  messages: Message[];
  messageCount: number;
  isActive: boolean;
  isWaitingForIntervention: boolean;
  interventionCount: number;
  nextResponder?: 'model-a' | 'model-b';
}

export interface AppState {
  panelA: ConversationPanel;
  panelB: ConversationPanel;
  conversation: ConversationState;
  isSetupComplete: boolean;
}

export const AI_MODELS: AIModel[] = [
  // OpenAI Models (Available)
  { id: 'gpt-4o', name: 'gpt-4o', displayName: 'GPT-4o (Latest)' },
  { id: 'gpt-4o-mini', name: 'gpt-4o-mini', displayName: 'GPT-4o Mini (Fast & Affordable)' },
  { id: 'gpt-4-turbo', name: 'gpt-4-turbo', displayName: 'GPT-4 Turbo (128K Context)' },
  { id: 'gpt-4', name: 'gpt-4', displayName: 'GPT-4 (Classic)' },
  
  // Coming Soon - Other Providers
  { id: 'claude-sonnet-3-5', name: 'claude-sonnet-3-5', displayName: 'Claude 3.5 Sonnet (Coming Soon)' },
  { id: 'claude-opus-3', name: 'claude-opus-3', displayName: 'Claude 3 Opus (Coming Soon)' },
  { id: 'gemini-pro', name: 'gemini-pro', displayName: 'Gemini Pro (Coming Soon)' },
];