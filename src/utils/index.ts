import type { AIModel } from '../types';

export const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getModelDisplayName = (model: AIModel | null): string => {
  return model?.displayName || 'Select Model';
};

export const validateSetup = (
  modelA: AIModel | null,
  modelB: AIModel | null,
  systemInstructionsA: string,
  systemInstructionsB: string,
  initialMessageA: string,
  initialMessageB: string
): boolean => {
  return !!(
    modelA && 
    modelB && 
    systemInstructionsA.trim() && 
    systemInstructionsB.trim() &&
    initialMessageA.trim() && 
    initialMessageB.trim()
  );
};

export const generateParticles = (count: number = 20) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    left: Math.random() * 100,
    animationDelay: Math.random() * 8,
    animationDuration: Math.random() * 4 + 6,
  }));
};

// Simulated AI response - in a real app, this would call actual AI APIs
export const simulateAIResponse = async (
  model: AIModel,
  messages: string[],
  _systemInstructions: string
): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2500));
  
  const messageCount = messages.length;
  
  const responseTemplates = [
    `Interesting perspective! From ${model.displayName}'s analysis, I'd like to add that we should also consider ${getRandomTopic()}...`,
    `I appreciate that point. However, ${model.displayName} suggests that ${getRandomCounterpoint()} might be more effective because...`,
    `Building on that idea, ${model.displayName} identifies ${getRandomBenefit()} as a key advantage of this approach...`,
    `That's a valid concern. ${model.displayName} recommends ${getRandomSolution()} to address this challenge...`,
    `From ${model.displayName}'s perspective, the data indicates that ${getRandomInsight()} which could significantly impact our decision...`,
    `I agree with your analysis. ${model.displayName} also suggests we examine ${getRandomFactor()} before proceeding...`,
  ];
  
  // Add some variety based on message count
  if (messageCount > 15) {
    responseTemplates.push(`After this extensive discussion, ${model.displayName} believes we're converging on ${getRandomConclusion()}...`);
    responseTemplates.push(`This has been a productive exchange. ${model.displayName} summarizes the key takeaway as ${getRandomSummary()}...`);
  }
  
  return responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
};

const getRandomTopic = () => {
  const topics = ['risk assessment', 'implementation timeline', 'resource allocation', 'stakeholder impact', 'long-term sustainability'];
  return topics[Math.floor(Math.random() * topics.length)];
};

const getRandomCounterpoint = () => {
  const points = ['a phased approach', 'parallel processing', 'iterative development', 'collaborative framework', 'data-driven methodology'];
  return points[Math.floor(Math.random() * points.length)];
};

const getRandomBenefit = () => {
  const benefits = ['cost efficiency', 'scalability', 'user adoption', 'operational flexibility', 'competitive advantage'];
  return benefits[Math.floor(Math.random() * benefits.length)];
};

const getRandomSolution = () => {
  const solutions = ['establishing clear metrics', 'creating feedback loops', 'implementing safeguards', 'developing contingency plans', 'conducting pilot testing'];
  return solutions[Math.floor(Math.random() * solutions.length)];
};

const getRandomInsight = () => {
  const insights = ['market trends are shifting toward this solution', 'user behavior patterns support this direction', 'technological advancements make this more viable', 'regulatory changes favor this approach', 'competitive analysis validates this strategy'];
  return insights[Math.floor(Math.random() * insights.length)];
};

const getRandomFactor = () => {
  const factors = ['environmental impact', 'regulatory compliance', 'technical feasibility', 'user experience implications', 'integration complexity'];
  return factors[Math.floor(Math.random() * factors.length)];
};

const getRandomConclusion = () => {
  const conclusions = ['a hybrid solution that combines our best ideas', 'prioritizing the most impactful initiatives first', 'the need for further stakeholder consultation', 'a clear implementation roadmap', 'the importance of monitoring key metrics'];
  return conclusions[Math.floor(Math.random() * conclusions.length)];
};

const getRandomSummary = () => {
  const summaries = ['balancing innovation with practical constraints', 'ensuring alignment with organizational goals', 'maintaining focus on user value', 'optimizing for both short and long-term outcomes', 'creating sustainable competitive advantages'];
  return summaries[Math.floor(Math.random() * summaries.length)];
};