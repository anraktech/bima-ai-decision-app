interface TypingIndicatorProps {
  sender: 'model-a' | 'model-b';
  modelName: string;
}

export const TypingIndicator = ({ sender, modelName }: TypingIndicatorProps) => {
  const getIndicatorStyle = () => {
    switch (sender) {
      case 'model-a':
        return 'ml-0 mr-auto bg-blue-500/10 border-blue-400/20';
      case 'model-b':
        return 'mr-0 ml-auto bg-purple-500/10 border-purple-400/20';
      default:
        return '';
    }
  };

  return (
    <div className={`glass rounded-lg p-4 max-w-md border ${getIndicatorStyle()}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white text-sm">
          {modelName}
        </span>
        <span className="text-gray-300 text-xs">
          typing...
        </span>
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.3s' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-typing" style={{ animationDelay: '0.6s' }}></div>
      </div>
    </div>
  );
};