import { useState } from 'react';
import { 
  Bot, 
  MessageSquare, 
  Sparkles,
  ChevronRight,
  Settings,
  Zap
} from 'lucide-react';
import { BaseModelDropdown } from './BaseModelDropdown';
import { ProfessionalPersonaDropdown } from './ProfessionalPersonaDropdown';
import type { AIModel } from '../types';
import type { ProfessionalPersona } from '../data/professionalPersonas';

interface MultiplayerSetupProps {
  onComplete: (setupData: {
    modelA: AIModel;
    modelB: AIModel;
    systemInstructionsA: string;
    systemInstructionsB: string;
    initialPrompt: string;
  }) => void;
  onBack: () => void;
}

export function MultiplayerSetup({ onComplete, onBack }: MultiplayerSetupProps) {
  const [modelA, setModelA] = useState<AIModel | null>(null);
  const [modelB, setModelB] = useState<AIModel | null>(null);
  const [systemInstructionsA, setSystemInstructionsA] = useState('');
  const [systemInstructionsB, setSystemInstructionsB] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [selectedPersonaA, setSelectedPersonaA] = useState<ProfessionalPersona | null>(null);
  const [selectedPersonaB, setSelectedPersonaB] = useState<ProfessionalPersona | null>(null);

  const handleModelSelectA = (model: AIModel) => {
    setModelA(model);
  };

  const handleModelSelectB = (model: AIModel) => {
    setModelB(model);
  };

  const handlePersonaSelectA = (persona: ProfessionalPersona | null) => {
    setSelectedPersonaA(persona);
    if (persona) {
      setSystemInstructionsA(persona.systemInstructions);
    }
  };

  const handlePersonaSelectB = (persona: ProfessionalPersona | null) => {
    setSelectedPersonaB(persona);
    if (persona) {
      setSystemInstructionsB(persona.systemInstructions);
    }
  };

  const isValid = modelA && modelB && systemInstructionsA && systemInstructionsB && initialPrompt;

  const handleStart = () => {
    if (isValid) {
      onComplete({
        modelA,
        modelB,
        systemInstructionsA,
        systemInstructionsB,
        initialPrompt
      });
    }
  };

  // Quick setup templates
  const templates = [
    {
      name: 'Tech Debate',
      prompt: 'Should AI development be regulated by governments?',
      instructionsA: 'You are a tech innovator who believes in minimal regulation and maximum innovation.',
      instructionsB: 'You are a policy expert who advocates for responsible AI governance.'
    },
    {
      name: 'Business Strategy',
      prompt: 'Should our company go fully remote or maintain office presence?',
      instructionsA: 'You are a progressive CEO who champions remote work and digital transformation.',
      instructionsB: 'You are a traditional executive who values in-person collaboration.'
    },
    {
      name: 'Climate Action',
      prompt: 'What is the most effective approach to combat climate change?',
      instructionsA: 'You are an environmental activist pushing for immediate, radical action.',
      instructionsB: 'You are an energy economist advocating for gradual, market-based solutions.'
    }
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setInitialPrompt(template.prompt);
    setSystemInstructionsA(template.instructionsA);
    setSystemInstructionsB(template.instructionsB);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-black px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Configure AI Battle Arena</h2>
                <p className="text-gray-300">Set up your AI models and let the debate begin!</p>
              </div>
              <Settings className="w-12 h-12 text-orange-500" />
            </div>
          </div>

          {/* Quick Templates */}
          <div className="px-8 py-6 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Templates</h3>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template) => (
                <button
                  key={template.name}
                  onClick={() => applyTemplate(template)}
                  className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-gray-900">{template.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{template.prompt}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 space-y-8">
            {/* Model Selection */}
            <div className="grid grid-cols-2 gap-8">
              {/* Primary Agent */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Primary Agent</h3>
                </div>

                <BaseModelDropdown
                  selectedModel={modelA}
                  onModelSelect={handleModelSelectA}
                  label="Select AI Model"
                  placeholder="Choose a model..."
                  accentColor="blue"
                  showSearch={true}
                  size="md"
                />

                <div>
                  <ProfessionalPersonaDropdown
                    onSelectPersona={handlePersonaSelectA}
                    selectedPersona={selectedPersonaA}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Instructions
                    <span className="block text-xs text-orange-600 font-normal mt-1">
                      💡 The better the system instructions, the better the performance
                    </span>
                  </label>
                  <textarea
                    value={systemInstructionsA}
                    onChange={(e) => setSystemInstructionsA(e.target.value)}
                    placeholder="Define the personality and role of this agent..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500"
                    rows={4}
                  />
                </div>
              </div>

              {/* Alternative Agent */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Alternative Agent</h3>
                </div>

                <BaseModelDropdown
                  selectedModel={modelB}
                  onModelSelect={handleModelSelectB}
                  label="Select AI Model"
                  placeholder="Choose a model..."
                  accentColor="red"
                  showSearch={true}
                  size="md"
                />

                <div>
                  <ProfessionalPersonaDropdown
                    onSelectPersona={handlePersonaSelectB}
                    selectedPersona={selectedPersonaB}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Instructions
                    <span className="block text-xs text-orange-600 font-normal mt-1">
                      💡 The better the system instructions, the better the performance
                    </span>
                  </label>
                  <textarea
                    value={systemInstructionsB}
                    onChange={(e) => setSystemInstructionsB(e.target.value)}
                    placeholder="Define the personality and role of this agent..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Initial Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Opening Topic / Question</span>
                </div>
              </label>
              <textarea
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                placeholder="What should the AI agents discuss? E.g., 'Should we invest in renewable energy?' or 'What's the best programming language?'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                This will be the starting point for the AI conversation
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
              <button
                onClick={onBack}
                className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Back to Lobby
              </button>
              
              <button
                onClick={handleStart}
                disabled={!isValid}
                className="px-8 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center space-x-3"
              >
                <Zap className="w-5 h-5" />
                <span>Start AI Battle</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}