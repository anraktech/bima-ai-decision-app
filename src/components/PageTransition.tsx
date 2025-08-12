import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStage, setTransitionStage] = useState<'idle' | 'fadeOut' | 'logo' | 'fadeIn'>('idle');
  const location = useLocation();
  const [previousLocation, setPreviousLocation] = useState(location);

  useEffect(() => {
    if (location.pathname !== previousLocation.pathname) {
      // Start transition sequence
      setIsTransitioning(true);
      setTransitionStage('fadeOut');

      // Fade out current content
      setTimeout(() => {
        setTransitionStage('logo');
      }, 150);

      // Show logo
      setTimeout(() => {
        setPreviousLocation(location);
        setTransitionStage('fadeIn');
      }, 600);

      // Fade in new content
      setTimeout(() => {
        setTransitionStage('idle');
        setIsTransitioning(false);
      }, 750);
    }
  }, [location, previousLocation]);

  if (transitionStage === 'logo') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/anrak-logo.png" 
            alt="ANRAK" 
            className="h-24 w-auto mx-auto animate-pulse"
          />
          <div className="mt-4">
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-opacity duration-150 ${
      transitionStage === 'fadeOut' ? 'opacity-0' : 
      transitionStage === 'fadeIn' ? 'opacity-100' : 
      'opacity-100'
    }`}>
      {children}
    </div>
  );
};