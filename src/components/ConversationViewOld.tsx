import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Pause, Play, RotateCcw, Send, Activity, User, Bot, ChevronDown, ArrowRight, Radio, Users, Copy, Check, X } from 'lucide-react';
import type { ConversationState, ConversationPanel, Message } from '../types';
import { formatTimestamp } from '../utils';
import { TypingIndicator } from './TypingIndicator';
import { useLiveSession } from '../hooks/useLiveSession';

interface ConversationViewProps {
  conversation: ConversationState;
  panelA: ConversationPanel;
  panelB: ConversationPanel;
  onContinueConversation: () => void;
  onAddIntervention: (intervention: string, targetAgent?: 'model-a' | 'model-b') => void;
  onReset: () => void;
  isMultiplayerMode?: boolean;
}

export const ConversationView = ({
  conversation,
  panelA,
  panelB,
  onContinueConversation,
  onAddIntervention,
  onReset,
  isMultiplayerMode = false,
}: ConversationViewProps) => {
  const [interventionText, setInterventionText] = useState('');
  const [showIntervention, setShowIntervention] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<'model-a' | 'model-b'>('model-b');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Live session hook
  const {
    shareCode,
    isConnected,
    viewerCount,
    startLiveSession,
    broadcastMessage,
    endLiveSession
  } = useLiveSession({ 
    conversationId: conversation.id, 
    isHost: true,
    predefinedToken: conversation.multiplayerConfig?.liveToken
  });

  // Create live session when public viewing is enabled
  useEffect(() => {
    if (conversation.isPublicViewable && conversation.id && conversation.multiplayerConfig?.liveToken) {
      const createLiveSession = async () => {
        try {
          const token = localStorage.getItem('token');
          await fetch('http://localhost:3001/api/live/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              conversationId: conversation.id,
              shareCode: conversation.multiplayerConfig.liveToken
            })
          });
          console.log('Live session created successfully');
        } catch (error) {
          console.error('Failed to create live session:', error);
        }
      };
      createLiveSession();
    }
  }, [conversation.isPublicViewable, conversation.id, conversation.multiplayerConfig?.liveToken]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);
  
  // Post new messages to live session
  useEffect(() => {
    if (conversation.isPublicViewable && conversation.multiplayerConfig?.liveToken && conversation.messages.length > 0) {
      const latestMessage = conversation.messages[conversation.messages.length - 1];
      
      const postMessage = async () => {
        try {
          const token = localStorage.getItem('token');
          await fetch('http://localhost:3001/api/live/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              shareCode: conversation.multiplayerConfig.liveToken,
              message: latestMessage
            })
          });
          console.log('Message posted to live session:', latestMessage.content.substring(0, 50));
        } catch (error) {
          console.error('Failed to post message to live session:', error);
        }
      };
      
      postMessage();
    }
  }, [conversation.messages.length, conversation.isPublicViewable, conversation.multiplayerConfig?.liveToken]);

  const copyShareCode = () => {
    const tokenToCopy = conversation.multiplayerConfig?.liveToken || shareCode;
    if (tokenToCopy) {
      navigator.clipboard.writeText(tokenToCopy);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  useEffect(() => {
    if (conversation.isWaitingForIntervention) {
      setShowIntervention(true);
    }
  }, [conversation.isWaitingForIntervention]);

  const handleIntervention = () => {
    if (interventionText.trim()) {
      onAddIntervention(interventionText, selectedTarget);
      setInterventionText('');
      setShowIntervention(false);
    }
  };

  const getMessageStyles = (sender: Message['sender']) => {
    switch (sender) {
      case 'model-a':
        return {
          bg: 'bg-gray-50',
          border: 'border-l-4 border-l-blue-500',
          text: 'text-black',
          accent: 'text-blue-600',
          icon: <Bot className="w-4 h-4" />
        };
      case 'model-b':
        return {
          bg: 'bg-gray-50',
          border: 'border-l-4 border-l-red-500',
          text: 'text-black',
          accent: 'text-red-600',
          icon: <Bot className="w-4 h-4" />
        };
      case 'user':
        return {
          bg: 'bg-indigo-50',
          border: 'border-l-4 border-l-indigo-500',
          text: 'text-black',
          accent: 'text-indigo-600',
          icon: <User className="w-4 h-4" />
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-l-4 border-l-gray-300',
          text: 'text-black',
          accent: 'text-gray-600',
          icon: <MessageSquare className="w-4 h-4" />
        };
    }
  };

  const getSenderInfo = (sender: Message['sender']) => {
    switch (sender) {
      case 'model-a':
        return {
          name: panelA.model?.displayName || 'Primary Agent',
          badge: 'Primary',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      case 'model-b':
        return {
          name: panelB.model?.displayName || 'Alternative Agent',
          badge: 'Alternative',
          badgeColor: 'bg-red-100 text-red-800'
        };
      case 'user':
        return {
          name: 'Human Intervention',
          badge: 'Moderator',
          badgeColor: 'bg-indigo-100 text-indigo-800'
        };
      default:
        return {
          name: 'Unknown',
          badge: '',
          badgeColor: ''
        };
    }
  };

  const targetOptions = [
    { value: 'model-a', label: 'Primary Agent', color: 'blue' },
    { value: 'model-b', label: 'Alternative Agent', color: 'red' }
  ];

  const selectedTargetOption = targetOptions.find(opt => opt.value === selectedTarget);

  // Check if there's a pending AI response
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const isWaitingForAI = conversation.isActive && !conversation.isWaitingForIntervention && 
    (lastMessage?.sender === 'user' || lastMessage?.sender === 'model-a' || lastMessage?.sender === 'model-b');

  return (
    <div className="space-y-4">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Active AI Conversation
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{conversation.messageCount} exchanges</span>
                  <span>•</span>
                  <span>{conversation.interventionCount} interventions</span>
                  {conversation.isWaitingForIntervention && (
                    <>
                      <span>•</span>
                      <span className="text-orange-600 font-medium flex items-center space-x-1">
                        <Pause className="h-3 w-3" />
                        <span>Intervention Required</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Live Session Controls - Show token if public viewing is enabled */}
              {isMultiplayerMode && conversation.isPublicViewable && (
                <div className="flex items-center space-x-2">
                  {/* Always show live status and token when public viewing is enabled */}
                  {true ? (
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                        <Radio className="h-4 w-4 text-orange-600 animate-pulse" />
                        <span className="text-sm font-medium text-orange-900">Live</span>
                        {viewerCount > 0 && (
                          <>
                            <span className="text-orange-600">•</span>
                            <div className="flex items-center space-x-1">
                              <Users className="h-3.5 w-3.5 text-orange-600" />
                              <span className="text-sm font-medium text-orange-900">{viewerCount}</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {(conversation.multiplayerConfig?.liveToken || shareCode) && (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                          <span className="text-xs text-gray-600">Live Token:</span>
                          <code className="text-sm font-mono text-gray-900">{conversation.multiplayerConfig?.liveToken || shareCode}</code>
                          <button
                            onClick={copyShareCode}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Copy share link"
                          >
                            {copiedCode ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-gray-600" />
                            )}
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={endLiveSession}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-md">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600">Connecting...</span>
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={onReset}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors space-x-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Message Area */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Conversation Log</h3>
        </div>
        
        <div className="h-[500px] overflow-y-auto">
          <div className="p-4 space-y-4">
            {conversation.messages.map((message) => {
              const styles = getMessageStyles(message.sender);
              const info = getSenderInfo(message.sender);
              
              return (
                <div key={message.id} className="transition-opacity duration-200">
                  <div className={`${styles.bg} ${styles.border} p-4`}>
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-full ${styles.accent} bg-white border-2 flex items-center justify-center flex-shrink-0`}>
                        {styles.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-semibold text-black">{info.name}</span>
                            {info.badge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.badgeColor}`}>
                                {info.badge}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                        <p className={`${styles.text} text-sm leading-relaxed whitespace-pre-wrap`}>
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isWaitingForAI && (
              <div className="transition-opacity duration-200">
                <div className="bg-gray-50 border-l-4 border-l-gray-400 p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-semibold text-black">
                          {lastMessage?.sender === 'model-a' ? (panelB.model?.displayName || 'Alternative Agent') : (panelA.model?.displayName || 'Primary Agent')}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                          Processing...
                        </span>
                      </div>
                      <TypingIndicator 
                        sender={lastMessage?.sender === 'model-a' ? 'model-b' : 'model-a'}
                        modelName={lastMessage?.sender === 'model-a' ? (panelB.model?.displayName || 'Alternative Agent') : (panelA.model?.displayName || 'Primary Agent')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {conversation.messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-gray-500">Conversation will begin once initialized</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Professional Intervention Panel */}
      {conversation.isWaitingForIntervention && (
        <div className="bg-orange-50 border border-orange-200">
          <div className="px-6 py-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <h3 className="text-lg font-semibold text-black">
                Intervention Checkpoint
              </h3>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                Every 10 Messages
              </span>
            </div>
            
            <p className="text-gray-600 mb-6">
              The AI agents have exchanged {conversation.messageCount} messages. Provide guidance to either agent or continue without intervention.
            </p>

            {showIntervention ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Target Agent
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-left hover:border-gray-400 transition-colors duration-200 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${selectedTargetOption?.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                        <span className="font-medium text-black">{selectedTargetOption?.label}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {dropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
                        {targetOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedTarget(option.value as 'model-a' | 'model-b');
                              setDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center space-x-2 text-sm"
                          >
                            <div className={`w-2 h-2 rounded-full ${option.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                            <span className="font-medium text-black">{option.label}</span>
                            {selectedTarget === option.value && (
                              <ArrowRight className="w-3 h-3 text-gray-400 ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Intervention Message
                  </label>
                  <textarea
                    value={interventionText}
                    onChange={(e) => setInterventionText(e.target.value)}
                    placeholder="Provide guidance, ask questions, or redirect the conversation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-black placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleIntervention}
                    disabled={!interventionText.trim()}
                    className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send to {selectedTargetOption?.label}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowIntervention(false);
                      setInterventionText('');
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowIntervention(true)}
                  className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 transition-colors space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Add Intervention</span>
                </button>
                
                <button
                  onClick={onContinueConversation}
                  className="inline-flex items-center px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Continue Without Intervention</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional Agent Summary Cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 shadow-sm">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <h4 className="text-sm font-semibold text-black">{panelA.model?.displayName}</h4>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">Primary</span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{panelA.systemInstructions}</p>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 shadow-sm">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <h4 className="text-sm font-semibold text-black">{panelB.model?.displayName}</h4>
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-medium">Alternative</span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{panelB.systemInstructions}</p>
          </div>
        </div>
      </div>
    </div>
  );
};