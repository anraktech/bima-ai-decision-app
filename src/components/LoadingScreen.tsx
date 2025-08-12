import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number;
  message?: string;
}

export const LoadingScreen = ({ 
  onComplete, 
  duration = 2500,
  message = "Initializing ANRAK Platform..." 
}: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setFade(true);
          setTimeout(() => {
            onComplete?.();
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, duration / 50);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className={`fixed inset-0 z-50 bg-white flex items-center justify-center transition-opacity duration-500 ${
      fade ? 'opacity-0' : 'opacity-100'
    }`}>
      <div className="text-center space-y-8">
        {/* ANRAK Logo - Large */}
        <div className="relative">
          <img 
            src="/anrak-logo.png" 
            alt="ANRAK" 
            className="h-32 w-auto mx-auto animate-pulse"
          />
          {/* Glowing effect */}
          <div className="absolute inset-0 h-32 w-auto mx-auto">
            <div className="w-full h-full bg-orange-500/20 rounded-lg blur-xl animate-pulse"></div>
          </div>
        </div>

        {/* Loading Message */}
        <div className="space-y-4">
          <p className="text-xl font-semibold text-gray-800 animate-fade-in">
            {message}
          </p>
          
          {/* Progress Bar */}
          <div className="w-80 mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Progress Percentage */}
          <p className="text-sm text-gray-600 font-medium">
            {Math.round(progress)}%
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};