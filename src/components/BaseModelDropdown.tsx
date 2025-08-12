import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Bot, Users, Database, Radio } from 'lucide-react';
import { useModelProviders } from '../hooks/useModelProviders';
import { useCustomModels } from '../hooks/useCustomModels';
import type { AIModel } from '../types';

interface BaseModelDropdownProps {
  selectedModel?: AIModel | null;
  onModelSelect: (model: AIModel) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  accentColor?: 'blue' | 'red' | 'orange' | 'emerald';
  disabled?: boolean;
  showSearch?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Provider color mapping for consistent branding
const providerColors = {
  openai: { bg: 'bg-emerald-100', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  anthropic: { bg: 'bg-blue-100', text: 'text-blue-600', dot: 'bg-blue-500' },
  google: { bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-500' },
  groq: { bg: 'bg-orange-100', text: 'text-orange-600', dot: 'bg-orange-500' },
  xai: { bg: 'bg-indigo-100', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  deepseek: { bg: 'bg-purple-100', text: 'text-purple-600', dot: 'bg-purple-500' }
} as const;

const getModelStatusIcon = (model: AIModel) => {
  if (!model) return null;
  
  // Custom/shared models
  if (model.isCustom || model.id.startsWith('custom-')) {
    return (
      <div className="flex items-center space-x-1 text-purple-600">
        <Bot className="w-3 h-3" />
        <span className="text-xs font-medium">Custom</span>
      </div>
    );
  }
  
  if (model.isShared || model.id.startsWith('shared-')) {
    return (
      <div className="flex items-center space-x-1 text-orange-600">
        <Users className="w-3 h-3" />
        <span className="text-xs font-medium">Shared</span>
      </div>
    );
  }
  
  // API-provided models are live
  const provider = model.provider || 'openai';
  const colors = providerColors[provider as keyof typeof providerColors] || providerColors.openai;
  
  return (
    <div className={`flex items-center space-x-1 ${colors.text}`}>
      <Radio className="w-3 h-3" />
      <span className="text-xs font-medium">Live</span>
    </div>
  );
};

const getProviderIcon = (providerId: string) => {
  const icons = {
    openai: '🤖',
    anthropic: '🧠', 
    google: '🔍',
    groq: '⚡',
    xai: '✨',
    deepseek: '🧬'
  };
  return icons[providerId as keyof typeof icons] || '🤖';
};

export const BaseModelDropdown = ({
  selectedModel,
  onModelSelect,
  label = "AI Model",
  placeholder = "Select AI Model",
  className = "",
  accentColor = 'blue',
  disabled = false,
  showSearch = true,
  size = 'md'
}: BaseModelDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { providers, loading: modelsLoading } = useModelProviders();
  const { customModels } = useCustomModels();


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, showSearch]);

  // Auto-expand providers with matching models when searching
  useEffect(() => {
    if (searchTerm) {
      const newExpanded = new Set<string>();
      providers.forEach(provider => {
        const hasMatchingModels = provider.models.some((model: any) =>
          model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (hasMatchingModels) {
          newExpanded.add(provider.id);
        }
      });
      
      if (customModels.some(model => 
        model.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      )) {
        newExpanded.add('custom');
      }
      
      setExpandedProviders(newExpanded);
    }
  }, [searchTerm, providers, customModels]);

  const toggleProvider = (providerId: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerId)) {
      newExpanded.delete(providerId);
    } else {
      newExpanded.add(providerId);
    }
    setExpandedProviders(newExpanded);
  };

  const filterModels = (models: any[], searchTerm: string) => {
    if (!searchTerm) return models;
    return models.filter(model =>
      model.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleModelSelect = (model: AIModel) => {
    onModelSelect(model);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Accent color classes
  const accentClasses = {
    blue: 'focus:border-blue-500 focus:ring-blue-500/20 border-blue-200',
    red: 'focus:border-red-500 focus:ring-red-500/20 border-red-200',
    orange: 'focus:border-orange-500 focus:ring-orange-500/20 border-orange-200',
    emerald: 'focus:border-emerald-500 focus:ring-emerald-500/20 border-emerald-200'
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm',
    lg: 'px-4 py-4 text-base'
  };

  const dotSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`group relative w-full ${sizeClasses[size]} bg-white border-2 rounded-xl text-left transition-all duration-200 hover:shadow-lg hover:shadow-gray-100/50 ${
          selectedModel 
            ? accentClasses[accentColor] 
            : 'border-gray-200 hover:border-gray-300'
        } ${
          isOpen ? 'shadow-lg shadow-gray-100/50 ' + accentClasses[accentColor] : ''
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {selectedModel ? (
              <>
                <div className={`${dotSizeClasses[size]} rounded-full flex-shrink-0 ${
                  selectedModel.isCustom || selectedModel.id.startsWith('custom-')
                    ? 'bg-purple-500'
                    : selectedModel.isShared || selectedModel.id.startsWith('shared-')
                    ? 'bg-orange-500'
                    : providerColors[selectedModel.provider as keyof typeof providerColors]?.dot || 'bg-blue-500'
                }`}></div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-gray-900 font-medium truncate">
                    {selectedModel.displayName || selectedModel.name}
                  </span>
                  <div className="flex items-center space-x-2 mt-0.5">
                    {getModelStatusIcon(selectedModel)}
                    {selectedModel.context && (
                      <span className="text-xs text-gray-500">
                        {selectedModel.context.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`${dotSizeClasses[size]} rounded-full bg-gray-300 flex-shrink-0`}></div>
                <span className="text-gray-500 font-medium">{placeholder}</span>
              </>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          } group-hover:text-gray-600`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl shadow-gray-900/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {showSearch && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {searchTerm && (
                <div className="mt-2 text-xs text-gray-600">
                  Searching across {providers.length + (customModels.length > 0 ? 1 : 0)} provider{providers.length + (customModels.length > 0 ? 1 : 0) !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
          
          <div className="max-h-80 overflow-y-auto">
            {modelsLoading ? (
              <div className="px-4 py-8 text-gray-500 text-center text-sm">Loading models...</div>
            ) : (
              <>
                {/* API Providers */}
                {providers.map((provider) => {
                  const filteredModels = filterModels(provider.models, searchTerm);
                  if (searchTerm && filteredModels.length === 0) return null;
                  
                  return (
                    <div key={provider.id} className="border-b border-gray-100 last:border-b-0">
                      {/* Provider Header */}
                      <button
                        onClick={() => toggleProvider(provider.id)}
                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getProviderIcon(provider.id)}</span>
                          <span className="text-sm font-semibold text-gray-700">
                            {provider.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${
                          expandedProviders.has(provider.id) ? 'rotate-180' : ''
                        }`} />
                      </button>
                      
                      {/* Provider Models */}
                      {expandedProviders.has(provider.id) && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                          {filteredModels.map((model: any) => (
                            <button
                              key={model.id}
                              onClick={() => handleModelSelect(model)}
                              className="w-full px-6 py-3 text-left hover:bg-gray-50 transition-colors duration-150 border-l-2 border-gray-200 group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    providerColors[provider.id as keyof typeof providerColors]?.dot || 'bg-blue-500'
                                  }`}></div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm truncate">{model.name}</p>
                                    <div className="flex items-center space-x-2 mt-0.5">
                                      {getModelStatusIcon(model)}
                                      {model.context && (
                                        <span className="text-xs text-gray-500">
                                          {model.context.toLocaleString()} tokens
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {selectedModel?.id === model.id && (
                                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Custom Models */}
                {customModels.length > 0 && (
                  <div className="border-b border-gray-100 last:border-b-0">
                    <button
                      onClick={() => toggleProvider('custom')}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🎨</span>
                        <span className="text-sm font-semibold text-gray-700">
                          Custom Models
                        </span>
                        <span className="text-xs text-gray-500">
                          ({filterModels(customModels, searchTerm).length} model{filterModels(customModels, searchTerm).length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${
                        expandedProviders.has('custom') ? 'rotate-180' : ''
                      }`} />
                    </button>
                    
                    {expandedProviders.has('custom') && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        {filterModels(customModels, searchTerm).map((model) => (
                          <button
                            key={model.id}
                            onClick={() => handleModelSelect(model)}
                            className="w-full px-6 py-3 text-left hover:bg-gray-50 transition-colors duration-150 border-l-2 border-purple-200 group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  model.isShared || model.id.startsWith('shared-') ? 'bg-orange-500' : 'bg-purple-500'
                                }`}></div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm truncate">
                                    {model.displayName || model.name}
                                  </p>
                                  <div className="flex items-center mt-0.5">
                                    {getModelStatusIcon(model)}
                                  </div>
                                </div>
                              </div>
                              {selectedModel?.id === model.id && (
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {providers.length === 0 && customModels.length === 0 && (
                  <div className="px-4 py-8 text-gray-500 text-center text-sm">
                    <Database className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No models available</p>
                    <p className="text-xs mt-1">Configure API keys to access models</p>
                  </div>
                )}
                
                {searchTerm && 
                 providers.every(p => filterModels(p.models, searchTerm).length === 0) && 
                 filterModels(customModels, searchTerm).length === 0 && (
                  <div className="px-4 py-8 text-gray-500 text-center text-sm">
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No models found matching "{searchTerm}"</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer with stats */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              {providers.reduce((acc, p) => acc + p.models.length, 0) + customModels.length} models • {providers.length + (customModels.length > 0 ? 1 : 0)} provider{providers.length + (customModels.length > 0 ? 1 : 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};