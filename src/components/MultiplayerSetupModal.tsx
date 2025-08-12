import { useState } from 'react';
import { X, User, AlertCircle, Check } from 'lucide-react';

interface MultiplayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: MultiplayerConfig) => void;
}

export interface MultiplayerConfig {
  currentUserRole: 'primary' | 'alternative';
  collaborativeUser: {
    email: string;
    role: 'primary' | 'alternative';
  };
  interventionMode: 'host-only' | 'both-users';
  isPublicViewable: boolean;
}

export function MultiplayerSetupModal({ isOpen, onClose, onConfirm }: MultiplayerSetupModalProps) {
  const [collaborativeEmail, setCollaborativeEmail] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<'primary' | 'alternative'>('primary');
  const [interventionMode, setInterventionMode] = useState<'host-only' | 'both-users'>('both-users');
  const [isPublicViewable, setIsPublicViewable] = useState(true);
  const [error, setError] = useState('');

  // The collaborative user automatically gets the opposite role
  const collaborativeUserRole: 'primary' | 'alternative' = currentUserRole === 'primary' ? 'alternative' : 'primary';

  const handleConfirm = () => {
    if (!collaborativeEmail.trim()) {
      setError('Please enter the collaborative user\'s email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(collaborativeEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    const config: MultiplayerConfig = {
      currentUserRole,
      collaborativeUser: {
        email: collaborativeEmail.trim(),
        role: collaborativeUserRole
      },
      interventionMode,
      isPublicViewable
    };
    
    onConfirm(config);
  };

  const getRoleIcon = (role: 'primary' | 'alternative') => {
    return role === 'primary' ? (
      <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
        <span className="text-white text-xs font-bold">A</span>
      </div>
    ) : (
      <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
        <span className="text-white text-xs font-bold">B</span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Setup Multiplayer Session</h2>
              <p className="text-gray-600 mt-1">Configure roles for collaborative AI conversation</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Role Selection for Current User */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Role</h3>
            <div className="space-y-2">
              {(['primary', 'alternative'] as const).map((role) => (
                <label key={role} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="currentUserRole"
                    value={role}
                    checked={currentUserRole === role}
                    onChange={(e) => setCurrentUserRole(e.target.value as 'primary' | 'alternative')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex items-center space-x-3">
                    {getRoleIcon(role)}
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {role} Agent Controller
                      </p>
                      <p className="text-sm text-gray-500">
                        {role === 'primary' 
                          ? 'You control the primary AI agent (Agent A)' 
                          : 'You control the alternative AI agent (Agent B)'
                        }
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Collaborative User Setup */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Collaborative User</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={collaborativeEmail}
                onChange={(e) => {
                  setCollaborativeEmail(e.target.value);
                  setError('');
                }}
                placeholder="collaborator@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Show the collaborative user's assigned role */}
            <div className="p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                {getRoleIcon(collaborativeUserRole)}
                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {collaborativeUserRole} Agent Controller
                  </p>
                  <p className="text-sm text-gray-500">
                    {collaborativeEmail || 'Collaborative user'} will control the {collaborativeUserRole} AI agent
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm mt-3">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Intervention Settings */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Intervention Permissions</h3>
            <div className="space-y-2">
              {[
                { value: 'host-only', label: 'Host Only', desc: 'Only you can intervene in the conversation' },
                { value: 'both-users', label: 'Both Users', desc: 'Both you and your collaborator can intervene' }
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="interventionMode"
                    value={option.value}
                    checked={interventionMode === option.value}
                    onChange={(e) => setInterventionMode(e.target.value as 'host-only' | 'both-users')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Public Viewing Option */}
          <div className="mb-6">
            <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublicViewable}
                onChange={(e) => setIsPublicViewable(e.target.checked)}
                className="text-orange-600 focus:ring-orange-500"
              />
              <div>
                <p className="font-medium text-gray-900">Allow Public Viewing</p>
                <p className="text-sm text-gray-500">Anyone with the share link can watch the conversation (read-only)</p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Start Collaborative Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}