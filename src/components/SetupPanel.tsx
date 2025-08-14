import { useState, memo, useCallback, useEffect } from 'react';
import { Play, MessageSquare, Check, AlertCircle, Sparkles, Users, Share2, Radio } from 'lucide-react';
import type { ConversationPanel, AIModel } from '../types';
import { IsolatedTextarea } from './IsolatedTextarea';
import { BaseModelDropdown } from './BaseModelDropdown';
import { ProfessionalPersonaDropdown } from './ProfessionalPersonaDropdown';
import type { ProfessionalPersona } from '../data/professionalPersonas';
import { ImportModelModal } from './ImportModelModal';
import { MultiplayerSetupModal, type MultiplayerConfig } from './MultiplayerSetupModal';
import { WatchLiveModal } from './WatchLiveModal';
import { LiveTokenModal } from './LiveTokenModal';
import { UsageLimitModal } from './UsageLimitModal';
import { useAuth } from '../contexts/AuthContext';
import { useLiveSession } from '../hooks/useLiveSession';
import { useUsageMonitor } from '../hooks/useUsageMonitor';

interface SetupPanelProps {
  panelA: ConversationPanel;
  panelB: ConversationPanel;
  onModelChange: (panelId: 'model-a' | 'model-b', model: AIModel) => void;
  onSystemInstructionsChange: (panelId: 'model-a' | 'model-b', instructions: string) => void;
  onInitialMessageChange: (panelId: 'model-a' | 'model-b', message: string) => void;
  onStartConversation: (startingAgent: 'model-a' | 'model-b', initialMessage: string, multiplayerConfig?: MultiplayerConfig) => void;
  isMultiplayerMode?: boolean;
}


// Helper function to generate share tokens
const generateShareToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) token += '-';
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const SetupPanel = memo(({
  panelA,
  panelB,
  onModelChange,
  onSystemInstructionsChange,
  onInitialMessageChange,
  onStartConversation,
  isMultiplayerMode = false,
}: SetupPanelProps) => {
  const [startingAgent, setStartingAgent] = useState<'model-a' | 'model-b'>('model-a');
  const [initialMessage, setInitialMessage] = useState('');
  const [selectedPersonaA, setSelectedPersonaA] = useState<ProfessionalPersona | null>(null);
  const [selectedPersonaB, setSelectedPersonaB] = useState<ProfessionalPersona | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMultiplayerSetup, setShowMultiplayerSetup] = useState(false);
  const [showWatchLiveModal, setShowWatchLiveModal] = useState(false);
  const [showLiveTokenModal, setShowLiveTokenModal] = useState(false);
  const [multiplayerConfig, setMultiplayerConfig] = useState<MultiplayerConfig | null>(null);
  const [pendingConversationStart, setPendingConversationStart] = useState<{agent: 'model-a' | 'model-b', message: string} | null>(null);
  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [importedModels, setImportedModels] = useState<AIModel[]>([]);
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const { token } = useAuth();

  // Usage monitoring for blocking over-limit users
  const { getUsageStatus } = useUsageMonitor();

  // No longer need to fetch imported models separately since they're now part of customModels

  const handleImportModel = (model: any) => {
    const formattedModel: AIModel = {
      id: model.id,
      name: model.name,
      displayName: `${model.name} (by ${model.owner.name})`,
      isCustom: true,
      isShared: true,
      baseModel: model.baseModel,
      systemInstructions: model.systemInstructions,
      openingStatement: model.openingStatement
    };
    setImportedModels(prev => [...prev, formattedModel]);
  };


  // When a custom model is selected, auto-fill its instructions
  useEffect(() => {
    if (panelA.model?.isCustom && panelA.model.systemInstructions) {
      onSystemInstructionsChange('model-a', panelA.model.systemInstructions);
      if (panelA.model.openingStatement) {
        onInitialMessageChange('model-a', panelA.model.openingStatement);
      }
    }
  }, [panelA.model?.id]);

  useEffect(() => {
    if (panelB.model?.isCustom && panelB.model.systemInstructions) {
      onSystemInstructionsChange('model-b', panelB.model.systemInstructions);
      if (panelB.model.openingStatement) {
        onInitialMessageChange('model-b', panelB.model.openingStatement);
      }
    }
  }, [panelB.model?.id]);

  const handleSystemInstructionsChangeA = useCallback((value: string) => {
    onSystemInstructionsChange('model-a', value);
  }, [onSystemInstructionsChange]);

  const handleSystemInstructionsChangeB = useCallback((value: string) => {
    onSystemInstructionsChange('model-b', value);
  }, [onSystemInstructionsChange]);

  // Handle persona selection for Agent A
  const handlePersonaSelectA = useCallback((persona: ProfessionalPersona | null) => {
    setSelectedPersonaA(persona);
    if (persona) {
      onSystemInstructionsChange('model-a', persona.systemInstructions);
    }
  }, [onSystemInstructionsChange]);

  // Handle persona selection for Agent B  
  const handlePersonaSelectB = useCallback((persona: ProfessionalPersona | null) => {
    setSelectedPersonaB(persona);
    if (persona) {
      onSystemInstructionsChange('model-b', persona.systemInstructions);
    }
  }, [onSystemInstructionsChange]);

  const usageStatus = getUsageStatus();
  const isOverLimit = usageStatus?.isOverLimit || false;
  
  const isSetupValid = Boolean(
    panelA.model && 
    panelB.model && 
    panelA.systemInstructions.trim() && 
    panelB.systemInstructions.trim() &&
    initialMessage.trim()
  );

  return (
    <div className="space-y-12">
      {/* Ultra-Premium Header */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center space-x-4 bg-gray-100 rounded-lg px-8 py-4">
          <div className="relative">
            <MessageSquare className="h-8 w-8 text-gray-600" />
            <Sparkles className="h-4 w-4 text-gray-500 absolute -top-1 -right-1" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-black">Configure Super Intelligence Conversation</h1>
            <p className="text-sm text-gray-600 font-medium">Advanced Super Intelligence Platform</p>
          </div>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <p className="text-lg text-gray-600 leading-relaxed">
            Deploy two super intelligent AI agents with competing perspectives and specialized expertise. 
            They'll engage in advanced cognitive discourse to unlock superhuman insights and breakthrough decision-making capabilities.
          </p>
          
          {/* Import Model Link & Watch Live - Only show in multiplayer mode */}
          {isMultiplayerMode && (
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center space-x-2 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors group"
              >
                <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Import community model</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">Use shared models from other users</span>
              </button>
              
              <button
                onClick={() => setShowWatchLiveModal(true)}
                className="inline-flex items-center space-x-2 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors group"
              >
                <Radio className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Watch Live</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">Join ongoing conversations with a live token</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Grid - Simplified */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Model A Panel - Cleaner Design */}
        <div className="bg-gradient-to-br from-blue-50/50 to-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          {/* Panel Header - Simplified */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold">A</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-black">Primary Agent</h3>
              <p className="text-xs text-gray-500">Configure your lead AI perspective</p>
            </div>
          </div>

            <BaseModelDropdown
              selectedModel={panelA.model}
              onModelSelect={(model) => onModelChange('model-a', model)}
              label="AI Model Selection"
              placeholder="Select AI Model"
              accentColor="blue"
              showSearch={true}
              size="md"
            />

            <ProfessionalPersonaDropdown
              onSelectPersona={handlePersonaSelectA}
              selectedPersona={selectedPersonaA}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                System Instructions
                {panelA.systemInstructions.trim() && (
                  <span className="ml-2 text-xs text-green-600">✓</span>
                )}
                <span className="block text-xs text-orange-600 font-normal mt-1">
                  💡 The better the system instructions, the better the performance
                </span>
              </label>
              <IsolatedTextarea
                initialValue={panelA.systemInstructions}
                onChange={handleSystemInstructionsChangeA}
                placeholder="Define this agent's role, expertise, and approach..."
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-black text-sm resize-none min-h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={5}
              />
            </div>
          </div>

        {/* Model B Panel - Cleaner Design */}
        <div className="bg-gradient-to-br from-red-50/50 to-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          {/* Panel Header - Simplified */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold">B</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-black">Alternative Agent</h3>
              <p className="text-xs text-gray-500">Configure your counter AI perspective</p>
            </div>
          </div>

            <BaseModelDropdown
              selectedModel={panelB.model}
              onModelSelect={(model) => onModelChange('model-b', model)}
              label="AI Model Selection"
              placeholder="Select AI Model"
              accentColor="red"
              showSearch={true}
              size="md"
            />

            <ProfessionalPersonaDropdown
              onSelectPersona={handlePersonaSelectB}
              selectedPersona={selectedPersonaB}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                System Instructions
                {panelB.systemInstructions.trim() && (
                  <span className="ml-2 text-xs text-green-600">✓</span>
                )}
                <span className="block text-xs text-orange-600 font-normal mt-1">
                  💡 The better the system instructions, the better the performance
                </span>
              </label>
              <IsolatedTextarea
                initialValue={panelB.systemInstructions}
                onChange={handleSystemInstructionsChangeB}
                placeholder="Define this agent's role, expertise, and approach..."
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-black text-sm resize-none min-h-28 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                rows={5}
              />
            </div>
          </div>
      </div>

      {/* Starting Agent Selection - Redesigned */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-8 space-y-6 shadow-sm">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-lg mb-3">
              <Play className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-black">Initialize Conversation</h2>
            <p className="text-sm text-gray-600 mt-1">Configure how the AI agents will begin their dialogue</p>
          </div>
          
          <div className="space-y-6">
            {/* Toggle Switch for Starting Agent */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-4">Select Starting Agent</label>
              <div className="flex items-center justify-center space-x-4">
                <div className={`text-sm font-medium transition-opacity ${startingAgent === 'model-a' ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <span>Primary</span>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setStartingAgent(startingAgent === 'model-a' ? 'model-b' : 'model-a')}
                  className="relative inline-flex h-8 w-16 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                  style={{
                    backgroundColor: startingAgent === 'model-a' ? '#2563eb' : '#dc2626'
                  }}
                >
                  <span className="sr-only">Toggle starting agent</span>
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${
                      startingAgent === 'model-a' ? 'translate-x-1' : 'translate-x-9'
                    }`}
                  />
                </button>
                
                <div className={`text-sm font-medium transition-opacity ${startingAgent === 'model-b' ? 'text-red-600' : 'text-gray-400'}`}>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">B</span>
                    </div>
                    <span>Alternative</span>
                  </div>
                </div>
              </div>
              
              {/* Selected Agent Display */}
              <div className="mt-4 text-center">
                <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
                  startingAgent === 'model-a' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                }`}>
                  <span className="text-xs font-medium">Starting with:</span>
                  <span className="text-sm font-semibold">
                    {startingAgent === 'model-a' 
                      ? (panelA.model?.displayName || 'Primary Agent')
                      : (panelB.model?.displayName || 'Alternative Agent')
                    }
                  </span>
                </div>
              </div>
            </div>
            
            {/* Initial Message Input - Cleaner Design */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Message
                <span className="text-gray-400 font-normal ml-2">• Required</span>
              </label>
              <IsolatedTextarea
                initialValue={initialMessage}
                onChange={setInitialMessage}
                placeholder="What question or topic would you like the AI agents to explore?"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-black text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all placeholder-gray-400"
                rows={3}
              />
              {initialMessage.trim() && (
                <div className="mt-2 flex items-center text-xs text-green-600">
                  <Check className="w-3 h-3 mr-1" />
                  <span>Message ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Section - Simplified */}
      <div className="flex flex-col items-center space-y-4">
        {!isSetupValid && (
          <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Complete all fields to start the conversation
            </p>
          </div>
        )}
        
        <button
          onClick={() => {
            // Block over-limit users from starting conversations
            if (isOverLimit) {
              setShowUsageLimitModal(true);
              return;
            }
            
            if (isMultiplayerMode) {
              setShowMultiplayerSetup(true);
            } else {
              onStartConversation(startingAgent, initialMessage);
            }
          }}
          disabled={!isSetupValid}
          className={`inline-flex items-center justify-center px-6 py-2.5 ${
            isOverLimit ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-gray-800'
          } text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:hover:scale-100 space-x-2 shadow-sm`}
        >
          <Play className="w-4 h-4" />
          <span>{isOverLimit ? 'Upgrade Required' : isMultiplayerMode ? 'Setup Multiplayer' : 'Start Conversation'}</span>
        </button>
      </div>

      {/* Professional Information Sections */}
      <div className="space-y-12 max-w-6xl mx-auto">
        
        {/* How It Works Section */}
        <div className="bg-white border-2 border-gray-200 shadow-sm">
          <div className="bg-black px-8 py-6">
            <h2 className="text-2xl font-bold text-white text-center">Advanced AI Conversation Platform</h2>
            <p className="text-gray-300 text-center mt-2">Deploy dual AI agents with competing perspectives for breakthrough insights</p>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-14 h-14 bg-orange-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xl">A</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-black text-lg">Primary Intelligence Agent</h3>
                    <p className="text-orange-600 text-sm font-medium">Lead Analysis & Strategy</p>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">Establishes foundational analysis through advanced reasoning, comprehensive knowledge synthesis, and strategic insight generation for complex decision-making scenarios.</p>
              </div>
              
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-14 h-14 bg-black flex items-center justify-center">
                    <span className="text-white font-bold text-xl">B</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-black text-lg">Alternative Intelligence Agent</h3>
                    <p className="text-orange-600 text-sm font-medium">Counter-Perspective & Refinement</p>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">Challenges, refines, and enhances primary analysis through alternative viewpoints, revealing blind spots and creating breakthrough cognitive insights.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Setup Guide */}
        <div className="bg-white border-2 border-gray-200 shadow-sm">
          <div className="bg-orange-500 px-8 py-6">
            <h2 className="text-2xl font-bold text-white text-center">Professional Setup Guide</h2>
            <p className="text-white/90 text-center mt-2">Four essential steps to deploy advanced AI conversations</p>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-black flex items-center justify-center">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <h3 className="font-bold text-black">Configure AI Models</h3>
                </div>
                <p className="text-gray-700 text-sm">Select advanced AI models for both agents. Define distinct roles, expertise areas, and contrasting perspectives to maximize cognitive discourse.</p>
              </div>
              
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 flex items-center justify-center">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <h3 className="font-bold text-black">Upload Knowledge Base</h3>
                </div>
                <p className="text-gray-700 text-sm">Enhance agents with custom knowledge using PDFs, DOCX, or RTF files. Creates domain-specific intelligence for specialized applications.</p>
              </div>
              
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-black flex items-center justify-center">
                    <span className="text-white font-bold">3</span>
                  </div>
                  <h3 className="font-bold text-black">Initialize Dialogue</h3>
                </div>
                <p className="text-gray-700 text-sm">Start conversations and observe sophisticated AI discourse. Agents challenge each other, building breakthrough insights through dialectical reasoning.</p>
              </div>
              
              <div className="bg-gray-50 border-2 border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500 flex items-center justify-center">
                    <span className="text-white font-bold">4</span>
                  </div>
                  <h3 className="font-bold text-black">Strategic Interventions</h3>
                </div>
                <p className="text-gray-700 text-sm">Intervene every 10 exchanges to guide conversations. Human-AI collaboration amplifies cognitive capabilities for enhanced decision-making.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Benefits */}
        <div className="bg-white border-2 border-gray-200 shadow-sm">
          <div className="bg-black px-8 py-6 border-b-4 border-orange-500">
            <h2 className="text-2xl font-bold text-white text-center">Platform Benefits</h2>
            <p className="text-gray-300 text-center mt-2">Transform your decision-making and cognitive capabilities</p>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border-2 border-orange-500 p-6 text-center">
                <div className="w-16 h-16 bg-orange-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-bold text-black mb-3 text-lg">Enhanced Decision Making</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Leverage multiple AI perspectives to uncover hidden factors, analyze complex scenarios, and make informed decisions with unprecedented clarity.</p>
              </div>
              
              <div className="bg-white border-2 border-black p-6 text-center">
                <div className="w-16 h-16 bg-black flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-bold text-black mb-3 text-lg">Accelerated Learning</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Observe advanced AI discourse, absorb complex reasoning patterns, and accelerate your understanding of sophisticated concepts and methodologies.</p>
              </div>
              
              <div className="bg-white border-2 border-orange-500 p-6 text-center">
                <div className="w-16 h-16 bg-orange-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-black mb-3 text-lg">Cognitive Amplification</h3>
                <p className="text-gray-700 text-sm leading-relaxed">Expand intellectual capabilities through AI partnership, tackling complex problems with innovative solutions and superhuman analytical power.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Best Practices */}
        <div className="bg-white border-2 border-gray-200 shadow-sm">
          <div className="bg-orange-500 px-8 py-6">
            <h2 className="text-2xl font-bold text-white text-center">Best Practices</h2>
            <p className="text-white/90 text-center mt-2">Professional recommendations for optimal AI conversation performance</p>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 border-l-4 border-orange-500 p-6">
                <h3 className="font-bold text-black mb-3 flex items-center space-x-2">
                  <div className="w-6 h-6 bg-orange-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white"></div>
                  </div>
                  <span>Opposing Perspectives</span>
                </h3>
                <p className="text-gray-700 text-sm">Design agents with fundamentally different viewpoints and methodologies to maximize intellectual discourse and breakthrough insights.</p>
              </div>
              
              <div className="bg-gray-50 border-l-4 border-black p-6">
                <h3 className="font-bold text-black mb-3 flex items-center space-x-2">
                  <div className="w-6 h-6 bg-black flex items-center justify-center">
                    <div className="w-2 h-2 bg-white"></div>
                  </div>
                  <span>Expertise Domains</span>
                </h3>
                <p className="text-gray-700 text-sm">Assign specific expertise areas to each agent, creating specialized knowledge domains for comprehensive analysis and decision support.</p>
              </div>
              
              <div className="bg-gray-50 border-l-4 border-orange-500 p-6">
                <h3 className="font-bold text-black mb-3 flex items-center space-x-2">
                  <div className="w-6 h-6 bg-orange-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white"></div>
                  </div>
                  <span>Strategic Interventions</span>
                </h3>
                <p className="text-gray-700 text-sm">Deploy intervention power strategically to guide conversations toward specific insights, breakthrough discoveries, and actionable outcomes.</p>
              </div>
              
              <div className="bg-gray-50 border-l-4 border-black p-6">
                <h3 className="font-bold text-black mb-3 flex items-center space-x-2">
                  <div className="w-6 h-6 bg-black flex items-center justify-center">
                    <div className="w-2 h-2 bg-white"></div>
                  </div>
                  <span>Knowledge Enhancement</span>
                </h3>
                <p className="text-gray-700 text-sm">Continuously enhance agents with relevant document uploads to maintain cutting-edge capabilities and domain expertise.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Model Modal */}
      <ImportModelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportModel}
      />
      
      {/* Multiplayer Setup Modal */}
      <MultiplayerSetupModal
        isOpen={showMultiplayerSetup}
        onClose={() => setShowMultiplayerSetup(false)}
        onConfirm={(config) => {
          setMultiplayerConfig(config);
          setShowMultiplayerSetup(false);
          setPendingConversationStart({ agent: startingAgent, message: initialMessage });
          
          // Always start the conversation with the config
          onStartConversation(startingAgent, initialMessage, config);
          
          // Generate and show token for live session if public viewing is enabled
          if (config.isPublicViewable) {
            const token = generateShareToken();
            setLiveToken(token);
            setShowLiveTokenModal(true);
          }
        }}
      />
      
      {/* Watch Live Modal */}
      <WatchLiveModal
        isOpen={showWatchLiveModal}
        onClose={() => setShowWatchLiveModal(false)}
      />
      
      {/* Live Token Modal */}
      <LiveTokenModal
        isOpen={showLiveTokenModal}
        onClose={() => {
          setShowLiveTokenModal(false);
        }}
        token={liveToken}
        onProceed={() => {
          setShowLiveTokenModal(false);
        }}
      />
      
      {/* Usage Limit Modal */}
      {showUsageLimitModal && usageStatus && (
        <UsageLimitModal
          isOpen={showUsageLimitModal}
          onClose={() => setShowUsageLimitModal(false)}
          currentUsage={usageStatus.currentUsage}
          usageLimit={usageStatus.usageLimit}
          currentPlan={usageStatus.currentPlan}
          overageAmount={usageStatus.overageAmount}
        />
      )}
    </div>
  );
});