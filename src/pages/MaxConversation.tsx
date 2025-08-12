import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateOpenAIResponse } from '../services/openai';
import { generateAnthropicResponse } from '../services/anthropic';
import { generateGoogleResponse } from '../services/google';
import { generateGroqResponse } from '../services/groq';
import { generateXAIResponse } from '../services/xai';
// Perplexity removed - models not working properly
import { generateDeepseekResponse } from '../services/deepseek';
import { 
  ArrowLeft, 
  Zap, 
  Send, 
  Bot,
  User,
  AlertCircle,
  Flame,
  Activity,
  TrendingUp,
  MessageSquare,
  RotateCw,
  Download,
  Copy,
  Check,
  Clock,
  Cpu,
  Loader2,
  BarChart3,
  MessageCircle
} from 'lucide-react';
import { formatTimestamp } from '../utils';
import type { AIModel } from '../types';

interface ModelConfig {
  id: number;
  model: AIModel;
  systemInstructions: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  name: string;
}

interface Message {
  id: string;
  modelId: number;
  modelName: string;
  modelAlias: string;
  content: string;
  timestamp: Date;
  type: 'ai' | 'intervention';
  icon: string;
  color: string;
  bgColor: string;
}

export function MaxConversation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interventionText, setInterventionText] = useState('');
  const [showIntervention, setShowIntervention] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [startTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState('00:00');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { models, startingModel, openingLine } = location.state || {};
  const activeModels = models?.filter((m: ModelConfig) => m.model) || [];
  
  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [startTime]);
  
  useEffect(() => {
    if (!models || !openingLine) {
      navigate('/max-mode');
      return;
    }
    
    // Start with the opening line from the selected starting model
    const startModel = activeModels.find((m: ModelConfig) => m.id === startingModel);
    if (startModel) {
      const firstMessage: Message = {
        id: `msg-${Date.now()}`,
        modelId: startModel.id,
        modelName: startModel.model.name,
        modelAlias: startModel.name,
        content: openingLine,
        timestamp: new Date(),
        type: 'ai',
        icon: startModel.icon,
        color: startModel.color,
        bgColor: startModel.bgColor
      };
      setMessages([firstMessage]);
      setMessageCount(1);
      
      // Find next model index
      const startIndex = activeModels.findIndex((m: ModelConfig) => m.id === startingModel);
      setCurrentModelIndex((startIndex + 1) % activeModels.length);
    }
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    // Check if intervention is needed (every 20 messages)
    if (messageCount > 0 && messageCount % 20 === 0 && !showIntervention) {
      setShowIntervention(true);
    }
  }, [messageCount]);
  
  useEffect(() => {
    // Auto-generate next response if not waiting for intervention
    if (messages.length > 0 && !isGenerating && !showIntervention) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' || lastMessage.type === 'intervention') {
        generateNextResponse();
      }
    }
  }, [messages, showIntervention]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const generateNextResponse = async () => {
    if (!activeModels.length || isGenerating) return;
    
    setIsGenerating(true);
    
    const currentModel = activeModels[currentModelIndex];
    
    if (!currentModel || !currentModel.model) {
      console.error('Current model is invalid:', currentModel);
      return;
    }
    
    const messageHistory = messages.map(msg => ({
      content: msg.content,
      sender: msg.type === 'intervention' ? 'user' : `model-${msg.modelId}`
    }));
    
    try {
      let response;
      const provider = currentModel.model.provider;
      const modelId = currentModel.model.id;
      
      if (!provider || !modelId) {
        console.error('Provider or modelId missing:', { provider, modelId, model: currentModel.model });
        return;
      }
      
      console.log('MAX MODE DEBUG:', {
        currentModelName: currentModel.name,
        provider,
        modelId,
        systemInstructions: currentModel.systemInstructions,
        messageHistoryLength: messageHistory.length
      });
      
      // Add context about other models to system instructions
      const enhancedInstructions = `${currentModel.systemInstructions}\n\nYou are Model ${currentModel.name} in a conversation with ${activeModels.length - 1} other AI models. Each model has its own perspective and expertise. Engage thoughtfully with the previous responses while maintaining your unique viewpoint.`;
      
      switch (provider) {
        case 'openai':
          console.log('Calling OpenAI with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateOpenAIResponse(modelId, enhancedInstructions, messageHistory);
          console.log('OpenAI response:', response);
          break;
        case 'anthropic':
          console.log('Calling Anthropic with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateAnthropicResponse(modelId, enhancedInstructions, messageHistory);
          console.log('Anthropic response:', response);
          break;
        case 'google':
          console.log('Calling Google with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateGoogleResponse(modelId, enhancedInstructions, messageHistory);
          console.log('Google response:', response);
          break;
        case 'groq':
          console.log('Calling Groq with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateGroqResponse(modelId, enhancedInstructions, messageHistory);
          console.log('Groq response:', response);
          break;
        case 'xai':
          console.log('Calling XAI with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateXAIResponse(modelId, enhancedInstructions, messageHistory);
          console.log('XAI response:', response);
          break;
        // Perplexity case removed - models not working properly
        case 'deepseek':
          console.log('Calling Deepseek with:', modelId, enhancedInstructions.substring(0, 100));
          response = await generateDeepseekResponse(modelId, enhancedInstructions, messageHistory);
          console.log('Deepseek response:', response);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
      
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        modelId: currentModel.id,
        modelName: currentModel.model.name,
        modelAlias: currentModel.name,
        content: response.content,
        timestamp: new Date(),
        type: 'ai',
        icon: currentModel.icon,
        color: currentModel.color,
        bgColor: currentModel.bgColor
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageCount(prev => prev + 1);
      setCurrentModelIndex((currentModelIndex + 1) % activeModels.length);
      
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Add error message to conversation
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        modelId: currentModel.id,
        modelName: currentModel.model?.displayName || 'AI Model',
        modelAlias: currentModel.name,
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
        timestamp: new Date(),
        color: currentModel.color,
        bgColor: currentModel.bgColor,
        borderColor: currentModel.borderColor,
        icon: '⚠️'
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setMessageCount(prev => prev + 1);
      setCurrentModelIndex((currentModelIndex + 1) % activeModels.length);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const sendIntervention = () => {
    if (!interventionText.trim()) return;
    
    const interventionMessage: Message = {
      id: `intervention-${Date.now()}`,
      modelId: 0,
      modelName: user?.name || 'Host',
      modelAlias: 'Host',
      content: interventionText,
      timestamp: new Date(),
      type: 'intervention',
      icon: '👤',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    };
    
    setMessages(prev => [...prev, interventionMessage]);
    setInterventionText('');
    setShowIntervention(false);
    setMessageCount(prev => prev + 1);
  };
  
  const copyTranscript = () => {
    const transcript = messages.map(msg => 
      `[${msg.modelAlias} - ${msg.modelName}]: ${msg.content}`
    ).join('\n\n');
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const downloadTranscript = () => {
    const transcript = messages.map(msg => 
      `[${msg.modelAlias} - ${msg.modelName}] (${formatTimestamp(msg.timestamp)}): ${msg.content}`
    ).join('\n\n');
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `max-mode-conversation-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const resetConversation = () => {
    if (confirm('Are you sure you want to reset the conversation and return to setup?')) {
      navigate('/max-mode');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/max-mode')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium hidden sm:inline">Exit</span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
                  <Flame className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                    MAX Arena Active
                  </h1>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    {activeModels.length} AI Models Engaged
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Stats */}
              <div className="hidden md:flex items-center space-x-3 text-sm">
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="font-mono font-medium text-gray-700">{elapsedTime}</span>
                </div>
                
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-700">{messageCount}</span>
                </div>
                
                {isGenerating && (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                    <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                    <span className="font-medium text-orange-700">Generating</span>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={copyTranscript}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy Transcript"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={downloadTranscript}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download Transcript"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                <button
                  onClick={resetConversation}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Reset Conversation"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Model Status Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto scrollbar-hide">
              {activeModels.map((model: ModelConfig, index: number) => (
                <div
                  key={model.id}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                    index === currentModelIndex && isGenerating
                      ? `${model.bgColor} ${model.borderColor} border-2 shadow-md scale-105`
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="text-lg">{model.icon}</span>
                  <div>
                    <p className={`font-medium text-xs sm:text-sm ${
                      index === currentModelIndex && isGenerating ? model.color : 'text-gray-700'
                    }`}>
                      {model.name}
                    </p>
                    <p className="text-xs text-gray-500 hidden sm:block">{model.model.name}</p>
                  </div>
                  {index === currentModelIndex && isGenerating && (
                    <div className="ml-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {showIntervention && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg animate-pulse">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-xs sm:text-sm font-medium text-amber-700">Intervention Point</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'intervention' ? 'justify-center' : 'justify-start'}`}
            >
              {message.type === 'intervention' ? (
                <div className="max-w-3xl w-full">
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-6 py-4 shadow-sm">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-purple-700">Host Intervention</span>
                      <span className="text-xs text-purple-500">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <p className="text-gray-800 leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-3 max-w-4xl w-full">
                  <div className={`w-10 h-10 rounded-lg ${message.bgColor} flex items-center justify-center flex-shrink-0 shadow-sm border ${message.borderColor || 'border-gray-200'}`}>
                    <span className="text-lg">{message.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline space-x-2 mb-1">
                      <span className={`font-semibold ${message.color}`}>{message.modelAlias}</span>
                      <span className="text-xs text-gray-500">• {message.modelName}</span>
                      <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {isGenerating && (
            <div className="flex justify-start">
              <div className="flex space-x-3 max-w-4xl w-full">
                <div className={`w-10 h-10 rounded-lg ${activeModels[currentModelIndex]?.bgColor} flex items-center justify-center flex-shrink-0 shadow-sm border ${activeModels[currentModelIndex]?.borderColor || 'border-gray-200'} animate-pulse`}>
                  <span className="text-lg">{activeModels[currentModelIndex]?.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className={`font-semibold ${activeModels[currentModelIndex]?.color}`}>
                      {activeModels[currentModelIndex]?.name}
                    </span>
                    <span className="text-xs text-gray-500">• {activeModels[currentModelIndex]?.model.name}</span>
                  </div>
                  <div className="bg-white rounded-xl px-5 py-4 shadow-sm border border-gray-200">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Intervention Input */}
      {showIntervention && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-gray-900">Intervention Point</span>
              <span className="text-sm text-gray-600">(Every 20 messages)</span>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={interventionText}
                onChange={(e) => setInterventionText(e.target.value)}
                placeholder="Guide the conversation with your intervention..."
                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && sendIntervention()}
              />
              <button
                onClick={sendIntervention}
                disabled={!interventionText.trim()}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center space-x-2 font-medium"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
              <button
                onClick={() => setShowIntervention(false)}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}