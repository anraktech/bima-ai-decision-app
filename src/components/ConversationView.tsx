import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Pause, RotateCcw, Send, User, Bot, ChevronDown, Info, RefreshCw } from 'lucide-react';
import type { ConversationState, ConversationPanel, Message } from '../types';
import { formatTimestamp } from '../utils';
import { useUsageMonitor } from '../hooks/useUsageMonitor';
import { UsageLimitModal } from './UsageLimitModal';

interface ConversationViewProps {
  conversation: ConversationState;
  panelA: ConversationPanel;
  panelB: ConversationPanel;
  onContinueConversation: () => void;
  onAddIntervention: (intervention: string, targetAgent?: 'model-a' | 'model-b') => void;
  onReset: () => void;
}

export const ConversationView = ({
  conversation,
  panelA,
  panelB,
  onContinueConversation,
  onAddIntervention,
  onReset,
}: ConversationViewProps) => {
  const [interventionText, setInterventionText] = useState('');
  const [showIntervention, setShowIntervention] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<'model-a' | 'model-b'>('model-b');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Usage monitoring
  const { showLimitModal, closeModal, getUsageStatus, recheckUsage } = useUsageMonitor();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  useEffect(() => {
    if (conversation.isWaitingForIntervention) {
      setShowIntervention(true);
    }
  }, [conversation.isWaitingForIntervention]);

  const handleIntervention = () => {
    if (interventionText.trim()) {
      // Block over-limit users from adding interventions
      const usageStatus = getUsageStatus();
      if (usageStatus?.isOverLimit) {
        return; // Don't allow intervention if over limit
      }
      
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

  return (
    <div className="bg-white shadow-lg rounded-lg">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <h2 className="text-xl font-semibold text-gray-900">AI Conversation Active</h2>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                  {conversation.messageCount} messages
                </span>
              </div>
              
              {conversation.isWaitingForIntervention && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-orange-600 font-medium">Intervention Required</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onReset}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-300 hover:border-red-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Disclaimers */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-3">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-blue-900">Performance Depends on Configuration</h4>
              <p className="text-xs text-blue-700 mt-1">
                Model performance heavily depends on your system instructions and opening message. Clear, specific instructions yield better results.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
          <div className="flex items-start space-x-3">
            <RefreshCw className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-gray-900">Model Issues or Slow Performance?</h4>
              <p className="text-xs text-gray-700 mt-1">
                If a model doesn't work properly or is too slow, try switching to a different model. Each AI model has different strengths and response times.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        <div className="space-y-6">
          {conversation.messages.map((message) => {
            const styles = getMessageStyles(message.sender);
            const info = getSenderInfo(message.sender);
            
            return (
              <div key={message.id} className={`${styles.bg} ${styles.border} p-4 rounded-r-lg transition-opacity duration-200`}>
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
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>


      {/* Intervention Section */}
      {showIntervention && (
        <div className="px-6 py-4 border-t border-gray-200 bg-amber-50">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Pause className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">Your intervention is needed</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post as which agent:
                </label>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${selectedTargetOption?.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                      <span>{selectedTargetOption?.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                      {targetOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSelectedTarget(option.value as 'model-a' | 'model-b');
                            setDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <div className={`w-2 h-2 rounded-full ${option.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your message:
                </label>
                <textarea
                  value={interventionText}
                  onChange={(e) => setInterventionText(e.target.value)}
                  placeholder="Enter your intervention message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  // Block over-limit users from continuing conversations
                  const usageStatus = getUsageStatus();
                  if (usageStatus?.isOverLimit) {
                    return; // Don't allow continuing if over limit
                  }
                  
                  setShowIntervention(false);
                  onContinueConversation();
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleIntervention}
                disabled={!interventionText.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Limit Modal */}
      {showLimitModal && getUsageStatus() && (
        <UsageLimitModal
          isOpen={showLimitModal}
          onClose={closeModal}
          currentUsage={getUsageStatus()!.currentUsage}
          usageLimit={getUsageStatus()!.usageLimit}
          currentPlan={getUsageStatus()!.currentPlan}
          overageAmount={getUsageStatus()!.overageAmount}
        />
      )}
    </div>
  );
};