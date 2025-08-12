import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, User, Briefcase, X } from 'lucide-react';
import { professionalPersonas, getPersonasByCategory } from '../data/professionalPersonas';
import type { ProfessionalPersona } from '../data/professionalPersonas';

interface ProfessionalPersonaDropdownProps {
  onSelectPersona: (persona: ProfessionalPersona | null) => void;
  selectedPersona: ProfessionalPersona | null;
}

export const ProfessionalPersonaDropdown = ({ onSelectPersona, selectedPersona }: ProfessionalPersonaDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const personasByCategory = getPersonasByCategory();
  const categories = Object.keys(personasByCategory);

  // Filter personas based on search term
  const filteredPersonas = professionalPersonas.filter(persona =>
    persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    persona.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get filtered personas by category
  const getFilteredPersonasByCategory = () => {
    if (searchTerm) {
      const grouped: Record<string, ProfessionalPersona[]> = {};
      filteredPersonas.forEach(persona => {
        if (!grouped[persona.category]) {
          grouped[persona.category] = [];
        }
        grouped[persona.category].push(persona);
      });
      return grouped;
    }
    return personasByCategory;
  };

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
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelectPersona = (persona: ProfessionalPersona) => {
    onSelectPersona(persona);
    setIsOpen(false);
    setSearchTerm('');
    setSelectedCategory(null);
  };

  const handleClearPersona = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectPersona(null);
  };

  const displayedCategories = searchTerm 
    ? Object.keys(getFilteredPersonasByCategory()).filter(cat => getFilteredPersonasByCategory()[cat].length > 0)
    : categories;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-800">
          Professional Personas <span className="text-gray-500">(Optional)</span>
        </label>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-3 bg-white border border-gray-300 rounded text-left hover:border-gray-400 transition-colors flex items-center justify-between cursor-pointer ${
            selectedPersona ? 'border-blue-500 bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {selectedPersona ? (
              <>
                <Briefcase className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-black text-sm truncate">{selectedPersona.name}</div>
                  <div className="text-xs text-gray-500 truncate">{selectedPersona.category}</div>
                </div>
                <button
                  onClick={handleClearPersona}
                  className="p-1 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
                  type="button"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 text-sm">Select a professional persona or write custom instructions</span>
              </>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-96 overflow-hidden">
          {/* Search Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search professions or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {searchTerm && (
              <div className="mt-2 text-xs text-gray-600">
                Found {filteredPersonas.length} profession{filteredPersonas.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Categories and Personas */}
          <div className="overflow-y-auto max-h-80">
            {displayedCategories.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No professions found matching "{searchTerm}"</p>
              </div>
            ) : (
              displayedCategories.map((category) => {
                const categoryPersonas = getFilteredPersonasByCategory()[category] || [];
                if (categoryPersonas.length === 0) return null;

                return (
                  <div key={category} className="border-b border-gray-100 last:border-b-0">
                    <div 
                      className={`px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${
                        selectedCategory === category ? 'bg-blue-50 text-blue-800' : 'text-gray-700'
                      }`}
                      onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Briefcase className="w-4 h-4" />
                          <span className="font-medium text-sm">{category}</span>
                          <span className="text-xs text-gray-500">({categoryPersonas.length})</span>
                        </div>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                          selectedCategory === category ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </div>
                    
                    {(selectedCategory === category || searchTerm) && (
                      <div className="bg-white">
                        {categoryPersonas.map((persona) => (
                          <button
                            key={persona.id}
                            onClick={() => handleSelectPersona(persona)}
                            className="w-full px-6 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0 group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-black text-sm group-hover:text-blue-800 transition-colors">
                                  {persona.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                  {persona.systemInstructions.substring(0, 120)}...
                                </div>
                              </div>
                              {selectedPersona?.id === persona.id && (
                                <div className="ml-3 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              {professionalPersonas.length} professional personas across {categories.length} categories
            </div>
          </div>
        </div>
      )}
    </div>
  );
};