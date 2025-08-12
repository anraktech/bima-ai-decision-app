import { useState } from 'react';
import { X, Radio, AlertCircle, Eye, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WatchLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WatchLiveModal({ isOpen, onClose }: WatchLiveModalProps) {
  const navigate = useNavigate();
  const [liveToken, setLiveToken] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinLive = async () => {
    if (!liveToken.trim()) {
      setError('Please enter a live session token');
      return;
    }

    // Format token to uppercase and add dash if needed
    const formattedToken = liveToken.trim().toUpperCase();
    
    // Basic validation - should be format XXXX-XXXX
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formattedToken) && !/^[A-Z0-9]{8}$/.test(formattedToken)) {
      setError('Invalid token format. Expected format: XXXX-XXXX');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Navigate to the live viewer page
      // The LiveViewer component will handle the connection and determine if user can collaborate
      const finalToken = formattedToken.includes('-') ? formattedToken : 
        `${formattedToken.slice(0, 4)}-${formattedToken.slice(4)}`;
      
      navigate(`/live/${finalToken}`);
      onClose();
    } catch (err) {
      setError('Failed to join live session');
      setIsJoining(false);
    }
  };

  const handleTokenChange = (value: string) => {
    // Auto-format as user types
    let formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (formatted.length > 4 && !formatted.includes('-')) {
      formatted = formatted.slice(0, 4) + '-' + formatted.slice(4, 8);
    }
    setLiveToken(formatted);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Watch Live Session</h2>
                <p className="text-sm text-gray-600">Join an ongoing AI conversation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Live Token Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Live Session Token
            </label>
            <input
              type="text"
              value={liveToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="XXXX-XXXX"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center font-mono text-lg tracking-wider"
              maxLength={9}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Enter the live session token shared by the host
            </p>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm mt-3">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Access Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">Access Levels</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Eye className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Watch Mode (Default)</p>
                  <p className="text-xs text-gray-500">View the conversation in real-time</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Collaboration Mode</p>
                  <p className="text-xs text-gray-500">Available if you're registered for this session</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinLive}
              disabled={isJoining || !liveToken.trim()}
              className="flex-1 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Join Live</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}