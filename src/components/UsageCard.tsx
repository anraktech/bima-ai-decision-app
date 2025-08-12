import { useState } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight,
  Zap
} from 'lucide-react';

export const UsageCard = () => {
  try {
    const { 
      subscription, 
      usage, 
      isLoading, 
      getRemainingTokens, 
      getUsagePercentage, 
      getOverageRate 
    } = useBilling();
    
    if (isLoading || !subscription) {
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
    
    return <UsageCardContent 
      subscription={subscription}
      usage={usage}
      getRemainingTokens={getRemainingTokens}
      getUsagePercentage={getUsagePercentage}
      getOverageRate={getOverageRate}
    />;
  } catch (error) {
    console.error('UsageCard error:', error);
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <p>Unable to load usage data</p>
        </div>
      </div>
    );
  }
};

const UsageCardContent = ({ subscription, usage, getRemainingTokens, getUsagePercentage, getOverageRate }: any) => {

  const usagePercentage = getUsagePercentage();
  const remainingTokens = getRemainingTokens();
  const isNearLimit = usagePercentage > 80;
  const hasOverage = subscription.overageTokens > 0;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = () => {
    if (hasOverage) return 'text-red-600';
    if (isNearLimit) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (hasOverage) return <AlertTriangle className="w-4 h-4" />;
    if (isNearLimit) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getProgressBarColor = () => {
    if (hasOverage) return 'bg-red-500';
    if (isNearLimit) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-gray-700" />
            <h3 className="font-semibold text-gray-900">Token Usage</h3>
          </div>
          <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-sm font-medium">
              {hasOverage ? 'Over Limit' : isNearLimit ? 'Near Limit' : 'On Track'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 capitalize">
              {subscription.tier} Plan
            </h4>
            <p className="text-sm text-gray-500">
              {formatNumber(subscription.tokensIncluded)} tokens/month
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(subscription.tokensUsed)}
            </p>
            <p className="text-sm text-gray-500">tokens used</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Usage Progress</span>
            <span>{Math.round(usagePercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            ></div>
            {hasOverage && (
              <div 
                className="h-full bg-red-300 transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, (subscription.overageTokens / subscription.tokensIncluded) * 100)}%`,
                  marginTop: '-8px'
                }}
              ></div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">Remaining</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {formatNumber(remainingTokens)}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">This Month</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {usage.conversationStats.thisMonth}
            </p>
            <p className="text-xs text-gray-500">conversations</p>
          </div>
        </div>

        {/* Overage Warning */}
        {hasOverage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">Usage Exceeded</h4>
                <p className="text-sm text-red-700 mb-2">
                  You've used {formatNumber(subscription.overageTokens)} tokens beyond your plan limit.
                </p>
                <p className="text-sm text-red-600">
                  Additional usage: <strong>${(subscription.overageTokens / 10000 * getOverageRate()).toFixed(2)}</strong>
                  <span className="text-xs ml-1">
                    (${getOverageRate()}/10K tokens)
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Near Limit Warning */}
        {isNearLimit && !hasOverage && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 mb-1">Approaching Limit</h4>
                <p className="text-sm text-orange-700">
                  You've used {Math.round(usagePercentage)}% of your monthly token allowance. 
                  Consider upgrading your plan to avoid overage charges.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex space-x-3 pt-2 border-t border-gray-100">
          <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <BarChart3 className="w-4 h-4" />
            <span>View Details</span>
          </button>
          
          {subscription.tier !== 'enterprise' && (
            <button className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors">
              <span>Upgrade Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};