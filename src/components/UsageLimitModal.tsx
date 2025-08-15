import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  X, 
  CreditCard, 
  Zap, 
  TrendingUp,
  ChevronRight,
  Rocket
} from 'lucide-react';

interface UsageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsage: number;
  usageLimit: number;
  currentPlan: string;
  overageAmount?: number;
}

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
  isOpen,
  onClose,
  currentUsage,
  usageLimit,
  currentPlan,
  overageAmount = 0
}) => {
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 150);
  };

  const handleUpgrade = () => {
    handleClose();
    navigate('/billing');
  };

  const usagePercentage = Math.min((currentUsage / usageLimit) * 100, 100);
  const isOverLimit = currentUsage > usageLimit;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className={`bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-150 ${
        isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isOverLimit ? 'bg-red-100' : 'bg-orange-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${isOverLimit ? 'text-red-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isOverLimit ? 'Usage Limit Exceeded' : 'Approaching Usage Limit'}
              </h3>
              <p className="text-sm text-gray-500">
                {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Usage Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Premium & Ultra Premium Token Usage</span>
              <span className="text-sm text-gray-500">
                {currentUsage.toLocaleString()} / {usageLimit.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-600 bg-green-50 border border-green-200 rounded-lg p-2">
              💡 <strong>Good News:</strong> Standard and Free tier models remain unlimited and can be used anytime!
            </p>
            
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  isOverLimit ? 'bg-red-500' : 
                  usagePercentage > 90 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
              {isOverLimit && (
                <div 
                  className="h-full bg-red-300 -mt-3"
                  style={{ 
                    width: `${Math.min(((overageAmount) / usageLimit) * 100, 100)}%` 
                  }}
                />
              )}
            </div>
            
            <div className="text-center">
              <span className={`text-lg font-bold ${
                isOverLimit ? 'text-red-600' : 
                usagePercentage > 90 ? 'text-orange-600' : 'text-green-600'
              }`}>
                {Math.round(usagePercentage)}%
              </span>
              <span className="text-sm text-gray-500 ml-1">of plan used</span>
            </div>
          </div>

          {/* Message */}
          <div className={`p-4 rounded-lg ${isOverLimit ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
            <p className={`text-sm ${isOverLimit ? 'text-red-800' : 'text-orange-800'}`}>
              {isOverLimit ? (
                <>
                  You've exceeded your monthly limit for <strong>Premium & Ultra Premium models</strong> by{' '}
                  <strong>{(overageAmount || 0).toLocaleString()} tokens</strong>. 
                  Upgrade your plan to continue using premium AI models.
                </>
              ) : (
                <>
                  You're approaching your monthly limit for <strong>Premium & Ultra Premium models</strong>. Consider upgrading 
                  to avoid premium model restrictions when you reach{' '}
                  <strong>{usageLimit.toLocaleString()} tokens</strong>.
                </>
              )}
            </p>
          </div>

          {/* Suggested Plans */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Recommended Plans</h4>
            
            {currentPlan === 'explore' && (
              <div className="p-3 border border-orange-200 rounded-lg bg-orange-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Rocket className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-orange-900">Starter Pack</p>
                      <p className="text-sm text-orange-700">250,000 tokens/month</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-900">$19/mo</p>
                    <p className="text-xs text-orange-600">Most Popular</p>
                  </div>
                </div>
              </div>
            )}

            {(currentPlan === 'explore' || currentPlan === 'starter') && (
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Professional</p>
                      <p className="text-sm text-gray-600">750,000 tokens/month</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">$49/mo</p>
                    <p className="text-xs text-gray-500">3x more tokens</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 rounded-b-xl space-y-3">
          <button
            onClick={handleUpgrade}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 font-medium shadow-lg"
          >
            <CreditCard className="w-4 h-4" />
            <span>Upgrade Plan</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-gray-600 hover:text-gray-800 transition-colors font-medium"
          >
            Continue with Current Plan
          </button>
        </div>
      </div>
    </div>
  );
};