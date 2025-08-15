import { useUsageMonitor } from '../hooks/useUsageMonitor';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  Calendar,
  BarChart3,
  ArrowRight
} from 'lucide-react';

const TIER_INFO = {
  ultra_premium: {
    name: 'Ultra Premium',
    color: 'slate',
    badge: '◆',
    description: '20,000 tokens/day • GPT-5, Claude Opus 4.1',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700',
    progressColor: 'bg-slate-600'
  },
  premium: {
    name: 'Premium',
    color: 'indigo',
    badge: '◇',
    description: '50,000 tokens/day • GPT-4o, Claude 3.5, Gemini 2.5',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
    progressColor: 'bg-indigo-600'
  },
  standard: {
    name: 'Standard',
    color: 'emerald',
    badge: '○',
    description: 'Unlimited • Most other AI models',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    progressColor: 'bg-emerald-600'
  },
  free: {
    name: 'Free',
    color: 'gray',
    badge: '◦',
    description: 'Unlimited • Free tier models',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    progressColor: 'bg-gray-400'
  }
};

export const TierUsageCard = () => {
  const navigate = useNavigate();
  const { usage, getUsageStatus } = useUsageMonitor();

  if (!usage) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  const usageStatus = getUsageStatus();

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatNumberWithCommas = (num: number) => {
    return num.toLocaleString();
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return (used / limit) * 100;
  };

  const getTierStatus = (used: number, limit: number) => {
    if (limit === -1) return { status: 'unlimited', color: 'text-green-600' };
    if (used >= limit) return { status: 'over_limit', color: 'text-red-600' };
    if (used >= limit * 0.9) return { status: 'approaching', color: 'text-orange-600' };
    return { status: 'healthy', color: 'text-green-600' };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-gray-700" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Daily Usage by Tier</h3>
              <p className="text-sm text-gray-600">Track your token usage across model tiers</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-white rounded-lg border">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {usage.userPlan.charAt(0).toUpperCase() + usage.userPlan.slice(1)} Plan
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Tier Breakdown */}
        <div className="space-y-4">
          {Object.entries(TIER_INFO).map(([tierKey, tierInfo]) => {
            const used = usage.todayUsage[tierKey as keyof typeof usage.todayUsage] || 0;
            const limit = usage.planLimits[tierKey as keyof typeof usage.planLimits] || -1;
            const remaining = usage.remainingTokens[tierKey as keyof typeof usage.remainingTokens] || 0;
            const percentage = getUsagePercentage(used, limit);
            const status = getTierStatus(used, limit);

            return (
              <div key={tierKey} className={`rounded-lg border ${tierInfo.borderColor} ${tierInfo.bgColor} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{tierInfo.badge}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">{tierInfo.name}</h4>
                      <p className="text-xs text-gray-600">{tierInfo.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${status.color}`}>
                      {status.status === 'unlimited' && 'Unlimited'}
                      {status.status === 'healthy' && 'On Track'}
                      {status.status === 'approaching' && 'Near Limit'}
                      {status.status === 'over_limit' && 'Over Limit'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatNumber(used)}
                    </span>
                    <span className="text-sm text-gray-500">tokens used</span>
                  </div>
                  {limit !== -1 && (
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-700">
                        {formatNumber(remaining)} remaining
                      </span>
                      <div className="text-xs text-gray-500">
                        of {formatNumber(limit)} daily
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {limit !== -1 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{formatNumberWithCommas(used)} / {formatNumberWithCommas(limit)}</span>
                      <span>{Math.round(percentage)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${tierInfo.progressColor}`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {limit === -1 && (
                  <div className="text-center py-2">
                    <span className="text-sm font-medium text-green-600">✨ Unlimited Usage</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall Summary */}
        <div className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Today's Summary</span>
            </h4>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(Object.values(usage.todayUsage).reduce((sum, tokens) => sum + tokens, 0))}
              </div>
              <div className="text-xs text-gray-600">Total Tokens Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {usage.historicalData?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Requests Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                ${(usage.totalCost || 0).toFixed(4)}
              </div>
              <div className="text-xs text-gray-600">Estimated Cost</div>
            </div>
          </div>
        </div>

        {/* Usage Warnings */}
        {usageStatus?.isOverLimit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">Daily Limit Exceeded</h4>
                <p className="text-sm text-red-700">
                  You've exceeded your daily limits for premium models. Upgrade your plan for higher daily limits.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-100">
          <button 
            onClick={() => navigate('/billing')}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>View Billing</span>
          </button>
          
          {usage.userPlan !== 'enterprise' && (
            <button 
              onClick={() => navigate('/billing')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
            >
              <span>Upgrade Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};