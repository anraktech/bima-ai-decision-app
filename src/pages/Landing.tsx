import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  BarChart3, 
  Bot, 
  Brain,
  TrendingUp,
  Building2,
  GraduationCap,
  Briefcase,
  Heart,
  Play,
  Menu,
  X,
  Database,
  Settings,
  Code,
  Users,
  Crown,
  Radio,
  Sparkles,
  Rocket,
  Check,
  MessageSquare
} from 'lucide-react';

export const Landing = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-white/95 backdrop-blur-lg border-b border-gray-100 shadow-sm' : 'bg-white/80 backdrop-blur-lg'
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src="/anrak-logo.png" 
                alt="ANRAK" 
                className="h-8 sm:h-12 md:h-16 lg:h-20 w-auto"
              />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-10">
              <a href="#platform" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Platform</a>
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Features</a>
              <a href="#enterprise" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Enterprise</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Pricing</a>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden lg:flex items-center space-x-4">
              <button 
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={() => navigate('/signup')}
                className="px-6 py-2.5 bg-black text-white hover:bg-gray-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md rounded-lg"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden absolute top-16 sm:top-20 left-0 right-0 bg-white border-b border-gray-100 shadow-lg">
              <div className="px-4 py-6 space-y-4">
                <a 
                  href="#platform" 
                  className="block text-gray-600 hover:text-gray-900 font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Platform
                </a>
                <a 
                  href="#features" 
                  className="block text-gray-600 hover:text-gray-900 font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#enterprise" 
                  className="block text-gray-600 hover:text-gray-900 font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Enterprise
                </a>
                <a 
                  href="#pricing" 
                  className="block text-gray-600 hover:text-gray-900 font-medium py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <div className="pt-4 space-y-3 border-t border-gray-100">
                  <button 
                    onClick={() => {
                      navigate('/login');
                      setIsMobileMenuOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-center text-gray-700 hover:text-gray-900 font-medium transition-colors border border-gray-300 rounded-lg"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/signup');
                      setIsMobileMenuOpen(false);
                    }}
                    className="block w-full px-4 py-3 bg-black text-white hover:bg-gray-800 transition-colors font-medium rounded-lg"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-12 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-white to-purple-50/20"></div>
        <div className="absolute top-20 left-4 sm:left-10 w-32 h-32 sm:w-72 sm:h-72 bg-blue-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-4 sm:right-10 w-48 h-48 sm:w-96 sm:h-96 bg-purple-100/30 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-5xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gray-50 rounded-full border border-gray-200 mb-6 sm:mb-8 shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 text-center">
                <span className="hidden sm:inline">NEW: Multiplayer Mode + 50+ AI models including GPT-4o, Claude & Gemini</span>
                <span className="sm:hidden">NEW: 50+ AI models + Multiplayer Mode</span>
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 sm:mb-8 leading-[1.1] px-2">
              <span className="bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                The Infrastructure For
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 bg-clip-text text-transparent">
                AI Decision-Making
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2">
              Enable AI agents to collaborate, debate, and reach consensus. 
              <span className="font-semibold text-gray-900 block sm:inline mt-2 sm:mt-0"> Build smarter decision systems</span> with your team in real-time multiplayer sessions.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 sm:mb-16 px-4">
              <button 
                onClick={() => navigate('/signup')}
                className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-black text-white font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 rounded-lg"
              >
                <span>Start Building Free</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2 rounded-lg">
                <Play className="w-5 h-5" />
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 mr-2" />
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">50+</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">AI Models Supported</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 mr-2" />
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">100%</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">Data Privacy</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mr-2" />
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">2min</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 font-medium">Setup Time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section id="platform" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              One Platform, Infinite Possibilities
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto px-2">
              From enterprise strategy to creative brainstorming, harness the collective intelligence of AI agents
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 rounded-lg">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Multi-Agent Conversations</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Watch AI agents debate, challenge assumptions, and build upon each other's ideas to reach better decisions.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 rounded-lg">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Custom Knowledge Base</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Upload your documents and create specialized AI agents with domain-specific expertise tailored to your needs.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 rounded-lg md:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-100 rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Deep Analytics</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Track decision patterns, token usage, and conversation insights with comprehensive analytics dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent-to-Agent Dashboard */}
      <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            {/* Content */}
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
                <Bot className="w-4 h-4" />
                <span>Core Feature</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
                Agent-to-Agent Intelligent Conversations
              </h2>
              
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed px-2 lg:px-0">
                Configure two AI agents with unique personalities and expertise, then watch them engage in 
                sophisticated debates, problem-solving sessions, and creative collaborations.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Settings className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Custom System Instructions</h4>
                    <p className="text-gray-600">Define unique personalities, expertise, and debate styles for each agent</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Briefcase className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Professional Personas</h4>
                    <p className="text-gray-600">Choose from 50+ pre-configured expert personas or create your own</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Interactive Interventions</h4>
                    <p className="text-gray-600">Guide the conversation direction with strategic prompts and questions</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => navigate('/signup')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2 rounded-lg shadow-lg"
              >
                <span>Start Agent Conversation</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Visual */}
            <div className="relative mt-8 lg:mt-0">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-4 sm:p-6 lg:p-8 border border-blue-200">
                {/* Mock Agent Configuration */}
                <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Agent Configuration</h3>
                  <div className="space-y-3">
                    <div className="p-3 border border-blue-200 rounded-lg bg-blue-50">
                      <div className="flex items-center space-x-2 mb-2">
                        <Bot className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-sm">Agent A: Strategic Analyst</span>
                      </div>
                      <p className="text-xs text-gray-600">GPT-4 • Risk-averse • Data-driven approach</p>
                    </div>
                    <div className="p-3 border border-indigo-200 rounded-lg bg-indigo-50">
                      <div className="flex items-center space-x-2 mb-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        <span className="font-medium text-sm">Agent B: Creative Innovator</span>
                      </div>
                      <p className="text-xs text-gray-600">Claude 3 • Bold thinker • Outside-the-box solutions</p>
                    </div>
                  </div>
                </div>
                
                {/* Mock Conversation */}
                <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center space-x-2">
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Live Conversation</span>
                  </h4>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <span className="font-medium text-blue-700">Strategic Analyst:</span>
                      <p className="text-gray-700 mt-1">Based on market data, we should focus on established channels...</p>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <span className="font-medium text-indigo-700">Creative Innovator:</span>
                      <p className="text-gray-700 mt-1">But what if we disrupted the entire model with a new approach...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAX Mode */}
      <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12 bg-gradient-to-r from-gray-50 to-orange-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            {/* Visual */}
            <div className="relative order-2 lg:order-1">
              <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-2xl p-4 sm:p-6 lg:p-8 border border-orange-200">
                {/* MAX Arena Interface */}
                <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🔥</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">MAX Arena Active</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { name: 'Alpha', color: 'bg-blue-500' },
                      { name: 'Beta', color: 'bg-purple-500' },
                      { name: 'Gamma', color: 'bg-green-500' },
                      { name: 'Delta', color: 'bg-yellow-500' },
                      { name: 'Epsilon', color: 'bg-red-500' }
                    ].map((model, index) => (
                      <div key={index} className={`px-2 py-1 ${model.color} text-white text-xs rounded-full font-medium`}>
                        {model.name}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    5 AI models • 47 messages • Intervention in 3 messages
                  </div>
                </div>
                
                {/* Mock Conversation */}
                <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                    <span>Multi-Agent Discussion</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 mt-0.5"></div>
                      <div>
                        <span className="font-medium text-blue-600">Alpha:</span>
                        <p className="text-gray-700">From a strategic perspective...</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-4 h-4 bg-purple-500 rounded-full flex-shrink-0 mt-0.5"></div>
                      <div>
                        <span className="font-medium text-purple-600">Beta:</span>
                        <p className="text-gray-700">I disagree with that approach...</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0 mt-0.5"></div>
                      <div>
                        <span className="font-medium text-green-600">Gamma:</span>
                        <p className="text-gray-700">Both perspectives have merit...</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 rounded-full text-sm font-medium mb-6">
                <span className="text-lg">🔥</span>
                <span>New: MAX Mode</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
                Maximum AI Firepower Unleashed
              </h2>
              
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed px-2 lg:px-0">
                Configure up to 5 AI models with unique personalities and watch them engage in 
                sophisticated multi-agent discussions. Pure intellectual firepower at scale.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">5</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">5-Model Configuration</h4>
                    <p className="text-gray-600">Alpha, Beta, Gamma, Delta, Epsilon - each with distinct expertise</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Strategic Interventions</h4>
                    <p className="text-gray-600">Guide the discussion every 20 messages with tactical interventions</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BarChart3 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Advanced Analytics</h4>
                    <p className="text-gray-600">Real-time metrics, transcript export, and conversation insights</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => navigate('/signup')}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-200 flex items-center justify-center space-x-2 rounded-lg shadow-lg"
              >
                <span>Enter MAX Arena</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="features" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-2">
              From Setup to Insights in Minutes
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-2">
              Professional-grade AI decision making, simplified
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="text-center group">
              <div className="relative mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <span className="text-xl sm:text-2xl font-bold text-white">1</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-1 sm:w-8 sm:h-1 bg-orange-200 rounded-full"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Configure Agents</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Select from 50+ AI models and define their roles and expertise</p>
            </div>

            {/* Step 2 */}
            <div className="text-center group">
              <div className="relative mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <span className="text-xl sm:text-2xl font-bold text-white">2</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-1 sm:w-8 sm:h-1 bg-red-200 rounded-full"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Upload Knowledge</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Enhance agents with your documents and specialized knowledge base</p>
            </div>

            {/* Step 3 */}
            <div className="text-center group">
              <div className="relative mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <span className="text-xl sm:text-2xl font-bold text-white">3</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-1 sm:w-8 sm:h-1 bg-gray-200 rounded-full"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Start Discussion</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Launch the AI conversation and watch agents collaborate in real-time</p>
            </div>

            {/* Step 4 */}
            <div className="text-center group">
              <div className="relative mb-4 sm:mb-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-600 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <span className="text-xl sm:text-2xl font-bold text-white">4</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-1 sm:w-8 sm:h-1 bg-orange-200 rounded-full"></div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Guide & Analyze</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Intervene when needed and extract insights from the decision process</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="enterprise" className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-12 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-2">
              Trusted Across Industries
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-2">
              From startups to Fortune 500, teams rely on ANRAK's AI Decision Platform for critical decisions
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Use Case 1 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-orange-200 rounded-lg">
              <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Strategic Planning</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Enterprise teams use multiple AI perspectives for strategic decisions, market analysis, and risk assessment.</p>
            </div>

            {/* Use Case 2 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 rounded-lg">
              <Code className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Technical Architecture</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Development teams leverage AI consensus for architecture decisions, code reviews, and technical problem-solving.</p>
            </div>

            {/* Use Case 3 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-red-200 rounded-lg">
              <Briefcase className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Legal Analysis</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Law firms utilize multiple AI agents for case analysis, contract review, and legal research validation.</p>
            </div>

            {/* Use Case 4 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-red-200 rounded-lg">
              <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Healthcare Research</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Medical professionals get second opinions from specialized AI models for diagnosis support and treatment planning.</p>
            </div>

            {/* Use Case 5 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-orange-200 rounded-lg">
              <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-orange-500 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Investment Analysis</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Financial firms use AI consensus for market analysis, portfolio decisions, investment strategy validation.</p>
            </div>

            {/* Use Case 6 */}
            <div className="group bg-white p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 rounded-lg">
              <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-200" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Academic Research</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Universities leverage AI collaboration for peer review, research validation, and academic decision-making processes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 sm:px-8 lg:px-12 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {/* Free Tier */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Explore</h3>
                <div className="mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500 ml-1 text-sm sm:text-base">/month</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600">
                  <strong>50,000</strong> free tokens/month
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Access to all AI models</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Basic conversation history</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Community support</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">No monthly commitment</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/signup')}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors text-sm sm:text-base"
              >
                Start Free
              </button>
            </div>

            {/* Starter Pack */}
            <div className="bg-white rounded-lg border-2 border-orange-500 p-6 sm:p-8 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-orange-500 text-white px-4 py-1 text-sm font-medium rounded-full">
                  Most Popular
                </span>
              </div>

              <div className="text-center mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <div className="mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$19</span>
                  <span className="text-gray-500 ml-1 text-sm sm:text-base">/month</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600">
                  <strong>250,000</strong> tokens/month
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">$0.76 per 10K beyond limit</p>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">All AI models available</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Priority processing</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Extended history</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Email support</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/signup')}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm sm:text-base"
              >
                Get Started
              </button>
            </div>

            {/* Professional */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Professional</h3>
                <div className="mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$49</span>
                  <span className="text-gray-500 ml-1 text-sm sm:text-base">/month</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600">
                  <strong>750,000</strong> tokens/month
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">$0.65 per 10K beyond limit</p>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Advanced analytics</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Conversation export</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">API access</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Priority support</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/signup')}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
              >
                Upgrade Now
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-lg border-2 border-purple-500 p-6 sm:p-8 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-500 text-white px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium rounded-full">
                  Enterprise
                </span>
              </div>

              <div className="text-center mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <div className="mb-3 sm:mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-500 ml-1 text-sm sm:text-base">/month</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600">
                  <strong>3M</strong> tokens/month
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">$0.50 per 10K beyond limit</p>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Custom endpoints</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Team management</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">Dedicated support</span>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs sm:text-sm">SLA guarantees</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/signup')}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-colors text-sm sm:text-base"
              >
                Contact Sales
              </button>
            </div>
          </div>

          {/* Pricing FAQ */}
          <div className="max-w-3xl mx-auto text-center px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Pricing FAQ</h3>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">What are tokens?</h4>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Tokens represent AI usage. ~1,000 tokens = ~750 words of conversation.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Can I change plans?</h4>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Yes, upgrade or downgrade anytime. Changes apply to your next billing cycle.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">What happens if I exceed my limit?</h4>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  You'll pay the overage rate listed. We'll notify you before limits are reached.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Is there a free trial?</h4>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                  Yes! The Explore plan gives you 50,000 free tokens every month, forever.
                </p>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8">
              <button 
                onClick={() => navigate('/billing')}
                className="inline-flex items-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <span>View Detailed Pricing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-12 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full bg-gray-800/10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 px-2">
            Ready to Transform Your Decision-Making?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto px-2 leading-relaxed">
            Join forward-thinking teams who are already using AI collaboration to make smarter, faster decisions
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 sm:mb-12 px-4">
            <button 
              onClick={() => navigate('/signup')}
              className="group w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 bg-white text-black font-semibold hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2 rounded-lg"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 border border-gray-600 font-semibold hover:bg-gray-800 transition-all duration-200 rounded-lg">
              Book a Demo
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 px-2">
            No credit card required • 50,000 free tokens • Professional support included
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12 sm:py-16 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
            {/* Product */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Product</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><a href="#platform" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Platform</a></li>
                <li><a href="#features" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Features</a></li>
                <li><a href="#pricing" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Pricing</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Company</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">About</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Blog</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Careers</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Resources</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Documentation</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">API Reference</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Support</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
              <ul className="space-y-2 sm:space-y-3">
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Terms of Service</a></li>
                <li><a href="#" className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors block">Security</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-6 sm:pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img 
                src="/anrak-logo.png" 
                alt="ANRAK" 
                className="h-16 sm:h-20 lg:h-24 w-auto"
              />
            </div>
            <p className="text-xs sm:text-sm text-gray-500 text-center md:text-right">© 2025 ANRAK. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};