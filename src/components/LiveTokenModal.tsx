import { useState } from 'react';
import { X, Radio, Copy, Check, ArrowRight } from 'lucide-react';

interface LiveTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onProceed: () => void;
}

export function LiveTokenModal({ isOpen, onClose, token, onProceed }: LiveTokenModalProps) {
  const [copied, setCopied] = useState(false);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <Radio className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Live Session Created!</h2>
                <p className="text-sm text-gray-600">Your collaborative session is ready</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Token Display */}
          <div className="mb-6">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-600 mb-3">Share this token with viewers:</p>
              <div className="flex items-center justify-center space-x-3">
                <code className="text-2xl font-mono font-bold text-orange-600 tracking-wider">
                  {token}
                </code>
                <button
                  onClick={copyToken}
                  className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                  title="Copy token"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-orange-600" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="mb-6 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2"></div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Live Broadcasting Enabled</p>
                <p className="text-xs text-gray-500">Your conversation will be visible to viewers in real-time</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2"></div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Collaborative Access</p>
                <p className="text-xs text-gray-500">Registered collaborators can participate in the conversation</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2"></div>
              <div>
                <p className="text-sm text-gray-700 font-medium">Public Viewing</p>
                <p className="text-xs text-gray-500">Anyone with the token can watch the conversation</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={copyToken}
              className="flex-1 px-4 py-2 text-orange-600 border border-orange-600 hover:bg-orange-50 rounded-lg transition-colors font-medium"
            >
              {copied ? 'Token Copied!' : 'Copy Token'}
            </button>
            <button
              onClick={onProceed}
              className="flex-1 px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Start Conversation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}