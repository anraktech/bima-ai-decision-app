import { useState, useEffect } from 'react';
import { useAppState } from '../hooks/useAppState';
import { Header } from '../components/Header';
import { SetupPanel } from '../components/SetupPanel';
import { ConversationView } from '../components/ConversationView';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUsageMonitor } from '../hooks/useUsageMonitor';
import { UsageLimitModal } from '../components/UsageLimitModal';
import { Database, LogOut, User, Users, Globe, Brain, Mail, Phone, MapPin, FileText, HelpCircle, CreditCard, Menu, X, Flame, CheckCircle, XCircle } from 'lucide-react';

export function Dashboard() {
  const { state, actions } = useAppState();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);

  // Usage monitoring for over-limit users
  const { showLimitModal, closeModal, getUsageStatus } = useUsageMonitor();

  // Handle payment success/failure from Stripe Checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const payment = urlParams.get('payment');
    const sessionId = urlParams.get('session_id') || urlParams.get('session');
    
    if (payment === 'success') {
      setPaymentStatus('success');
      
      // If we have a session ID, verify it with the backend
      if (sessionId) {
        fetch(`${API_URL}/api/stripe/verify-session/${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.paid) {
              console.log('Payment verified successfully!');
              // Optionally refresh user data
              window.location.reload();
            }
          })
          .catch(err => console.error('Session verification failed:', err));
      }
      
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setPaymentStatus(null);
      }, 5000);
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-hide cancelled message after 3 seconds
      setTimeout(() => {
        setPaymentStatus(null);
      }, 3000);
    }
  }, [location.search]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Navigation Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Header />
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-4">
              {/* Multiplayer button hidden for now
              <button
                onClick={() => navigate('/multiplayer')}
                className="flex items-center space-x-2 px-4 py-2 bg-black text-white hover:bg-gray-800 transition-all rounded-lg shadow"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Multiplayer</span>
              </button>
              */}
              
              <button
                onClick={() => navigate('/max-mode')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-black border-2 border-orange-500 hover:bg-orange-500 hover:text-white transition-all rounded-lg shadow-sm"
              >
                <Brain className="w-4 h-4" />
                <span className="text-sm font-medium">MAX Mode</span>
              </button>
              
              <button
                onClick={() => navigate('/models')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors rounded"
              >
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">My Models</span>
              </button>
              
              <button
                onClick={() => navigate('/community')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors rounded"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Community</span>
              </button>
              
              <button
                onClick={() => navigate('/billing')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors rounded"
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Billing</span>
              </button>
              
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors rounded-lg"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{user?.name}</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
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
            <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg z-50">
              <div className="px-4 py-6 space-y-4">
                {/* Multiplayer button hidden for now
                <button
                  onClick={() => {
                    navigate('/multiplayer');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 bg-black text-white hover:bg-gray-800 transition-all rounded-lg shadow"
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Multiplayer</span>
                </button>
                */}
                
                <button
                  onClick={() => {
                    navigate('/max-mode');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 bg-white text-black border-2 border-orange-500 hover:bg-orange-500 hover:text-white transition-all rounded-lg shadow-sm"
                >
                  <Brain className="w-5 h-5" />
                  <span className="font-medium">MAX Mode</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/models');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors rounded-lg"
                >
                  <Database className="w-5 h-5" />
                  <span className="font-medium">My Models</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/community');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors rounded-lg"
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">Community</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/billing');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 transition-colors rounded-lg"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="font-medium">Billing</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 w-full px-4 py-3 text-gray-600 hover:bg-gray-100 transition-colors rounded-lg"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">{user?.name}</span>
                </button>
                
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!state.isSetupComplete ? (
          <SetupPanel
            panelA={state.panelA}
            panelB={state.panelB}
            onModelChange={actions.setModel}
            onSystemInstructionsChange={actions.setSystemInstructions}
            onInitialMessageChange={actions.setInitialMessage}
            onStartConversation={actions.startConversation}
          />
        ) : (
          <ConversationView
            conversation={state.conversation}
            panelA={state.panelA}
            panelB={state.panelB}
            onContinueConversation={actions.continueConversation}
            onAddIntervention={actions.addUserIntervention}
            onReset={actions.resetConversation}
          />
        )}
      </main>
      
      {/* Footer - Conditional based on conversation state */}
      {state.conversation.isActive ? (
        /* Minimal Footer during active conversations */
        <footer className="bg-white border-t border-gray-100 py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center">
            <p className="text-xs text-gray-400">© 2025 ANRAK. All rights reserved.</p>
          </div>
        </footer>
      ) : (
        /* Full Footer when no active conversation */
        <footer className="bg-gray-50 border-t border-gray-100 py-12 sm:py-16 px-4 sm:px-6 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
              {/* Resources */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Resources</h4>
                <ul className="space-y-2 sm:space-y-3">
                  <li>
                    <button 
                      onClick={() => setShowDocumentation(true)}
                      className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors text-left block"
                    >
                      Documentation
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => setShowSupport(true)}
                      className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors text-left block"
                    >
                      Support
                    </button>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4>
                <ul className="space-y-2 sm:space-y-3">
                  <li>
                    <button 
                      onClick={() => setShowPrivacyPolicy(true)}
                      className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm transition-colors text-left block"
                    >
                      Privacy Policy
                    </button>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div className="sm:col-span-2 md:col-span-1">
                <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Contact</h4>
                <ul className="space-y-2 sm:space-y-3">
                  <li className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <a href="mailto:kapil@anrak.io" className="hover:text-gray-900 transition-colors break-all">kapil@anrak.io</a>
                  </li>
                  <li className="flex items-start space-x-2 text-xs sm:text-sm text-gray-600">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col space-y-1">
                      <span>+44 7931 802822 (UK)</span>
                      <span>+234 808 750 7942 (NG)</span>
                      <span>+91 7330 675777 (IN)</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-2 text-xs sm:text-sm text-gray-600">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col space-y-1">
                      <span>London, UK</span>
                      <span>Hyderabad, India</span>
                      <span>Lagos, Nigeria</span>
                    </div>
                  </li>
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
      )}

      {/* Documentation Modal */}
      {showDocumentation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="bg-black px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <h2 className="text-lg sm:text-xl font-bold text-white">Documentation</h2>
              </div>
              <button 
                onClick={() => setShowDocumentation(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
              <div className="space-y-4 sm:space-y-6">
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Getting Started</h3>
                  <p className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3 leading-relaxed">Welcome to ANRAK's AI Decision Platform. Follow these steps to set up your first AI conversation:</p>
                  <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-700 ml-2 sm:ml-4">
                    <li>Select AI models for both Primary Agent (A) and Alternative Agent (B)</li>
                    <li>Write detailed system instructions for each agent</li>
                    <li>Define an opening question or topic</li>
                    <li>Start the conversation and observe AI collaboration</li>
                    <li>Intervene every 10 exchanges to guide the discussion</li>
                  </ol>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">AI Model Selection</h3>
                  <p className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3 leading-relaxed">Choose from our supported AI providers:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-700 ml-2 sm:ml-4">
                    <li><strong>OpenAI:</strong> GPT-4o, GPT-4o Mini, GPT-4 Turbo</li>
                    <li><strong>Anthropic:</strong> Claude 3.5 Sonnet, Claude 3 Haiku</li>
                    <li><strong>Google:</strong> Gemini Pro, Gemini Flash</li>
                    <li><strong>Groq:</strong> Llama 3.1, Mixtral</li>
                    <li><strong>xAI:</strong> Grok models</li>
                    <li><strong>Deepseek:</strong> Deep reasoning models</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Custom Models</h3>
                  <p className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3 leading-relaxed">Create specialized AI agents with custom knowledge:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-700 ml-2 sm:ml-4">
                    <li>Upload PDF, DOCX, or RTF documents (max 3 files)</li>
                    <li>Define specialized system instructions</li>
                    <li>Share models with the community using tokens</li>
                    <li>Import models from other users</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Best Practices</h3>
                  <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-gray-700 ml-2 sm:ml-4">
                    <li>Write detailed system instructions for better performance</li>
                    <li>Create opposing perspectives for breakthrough insights</li>
                    <li>Use strategic interventions to guide conversations</li>
                    <li>Leverage expertise domains for specialized analysis</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="bg-orange-500 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <h2 className="text-lg sm:text-xl font-bold text-white">Support Center</h2>
              </div>
              <button 
                onClick={() => setShowSupport(false)}
                className="text-orange-100 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
              <div className="space-y-4 sm:space-y-6">
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Contact Support</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 sm:space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm sm:text-base">Email Support</p>
                        <a href="mailto:kapil@anrak.io" className="text-orange-600 hover:text-orange-700 text-sm break-all">kapil@anrak.io</a>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-2 sm:space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 mt-1 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Phone Support</p>
                        <div className="space-y-1 text-xs sm:text-sm text-gray-700">
                          <p>🇬🇧 UK: +44 7931 802822</p>
                          <p>🇳🇬 Nigeria: +234 808 750 7942</p>
                          <p>🇮🇳 India: +91 7330 675777</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Business Hours</h3>
                  <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
                    <p className="text-gray-700 text-sm sm:text-base">Monday - Friday: 9:00 AM - 6:00 PM (GMT)</p>
                    <p className="text-gray-700 text-sm sm:text-base">Weekend: Limited support via email</p>
                    <p className="text-xs sm:text-sm text-orange-600 mt-2">We aim to respond to all inquiries within 24 hours</p>
                  </div>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Common Issues</h3>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <details className="cursor-pointer">
                      <summary className="font-medium text-gray-900 hover:text-orange-600 p-2 bg-gray-50 rounded text-sm">API Keys not working</summary>
                      <div className="p-3 text-gray-700 text-xs sm:text-sm leading-relaxed">
                        <p>Ensure your API keys are correctly configured in your environment. Check that all required providers have valid keys.</p>
                      </div>
                    </details>
                    <details className="cursor-pointer">
                      <summary className="font-medium text-gray-900 hover:text-orange-600 p-2 bg-gray-50 rounded text-sm">Conversations not starting</summary>
                      <div className="p-3 text-gray-700 text-xs sm:text-sm leading-relaxed">
                        <p>Make sure both agents have system instructions and an opening message is provided. Check that your AI models are properly selected.</p>
                      </div>
                    </details>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="bg-black px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white">Privacy Policy</h2>
              <button 
                onClick={() => setShowPrivacyPolicy(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-60px)] sm:max-h-[calc(90vh-80px)]">
              <div className="space-y-4 sm:space-y-6 text-gray-700">
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Information We Collect</h3>
                  <p className="text-sm sm:text-base leading-relaxed">We collect information you provide directly to us, including:</p>
                  <ul className="list-disc list-inside ml-2 sm:ml-4 mt-2 space-y-1 text-xs sm:text-sm">
                    <li>Account information (name, email, password)</li>
                    <li>AI conversation data and custom models</li>
                    <li>Usage analytics and performance metrics</li>
                    <li>Support communications</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">How We Use Your Information</h3>
                  <p className="text-sm sm:text-base leading-relaxed">We use collected information to:</p>
                  <ul className="list-disc list-inside ml-2 sm:ml-4 mt-2 space-y-1 text-xs sm:text-sm">
                    <li>Provide and improve our AI services</li>
                    <li>Process your AI conversations and custom models</li>
                    <li>Send service updates and support communications</li>
                    <li>Analyze usage patterns to enhance platform performance</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Data Security</h3>
                  <p className="text-sm sm:text-base leading-relaxed">We implement appropriate security measures to protect your information:</p>
                  <ul className="list-disc list-inside ml-2 sm:ml-4 mt-2 space-y-1 text-xs sm:text-sm">
                    <li>Encryption in transit and at rest</li>
                    <li>Regular security audits and updates</li>
                    <li>Access controls and authentication</li>
                    <li>Secure cloud infrastructure</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Data Sharing</h3>
                  <p className="text-sm sm:text-base leading-relaxed">We do not sell or rent your personal information. We may share information only:</p>
                  <ul className="list-disc list-inside ml-2 sm:ml-4 mt-2 space-y-1 text-xs sm:text-sm">
                    <li>With your explicit consent</li>
                    <li>To comply with legal obligations</li>
                    <li>With service providers under strict contracts</li>
                    <li>In case of business transfer (merger, acquisition)</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Your Rights</h3>
                  <p className="text-sm sm:text-base leading-relaxed">You have the right to:</p>
                  <ul className="list-disc list-inside ml-2 sm:ml-4 mt-2 space-y-1 text-xs sm:text-sm">
                    <li>Access and download your data</li>
                    <li>Correct inaccurate information</li>
                    <li>Delete your account and data</li>
                    <li>Opt out of marketing communications</li>
                  </ul>
                </section>
                
                <section>
                  <h3 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">Contact</h3>
                  <p className="text-sm sm:text-base leading-relaxed">For privacy-related questions, contact us at:</p>
                  <p className="mt-2 text-xs sm:text-sm"><strong>Email:</strong> kapil@anrak.io</p>
                  <p className="text-xs sm:text-sm"><strong>Address:</strong> London, UK | Hyderabad, India | Lagos, Nigeria</p>
                </section>
                
                <section className="text-xs sm:text-sm text-gray-500">
                  <p><strong>Last Updated:</strong> January 2025</p>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Status Notifications */}
      {paymentStatus && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-300">
          {paymentStatus === 'success' && (
            <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3">
              <CheckCircle className="w-6 h-6" />
              <div>
                <p className="font-medium">Payment Successful!</p>
                <p className="text-sm text-green-100">Your subscription has been upgraded.</p>
              </div>
              <button
                onClick={() => setPaymentStatus(null)}
                className="text-green-100 hover:text-white ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {paymentStatus === 'cancelled' && (
            <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3">
              <XCircle className="w-6 h-6" />
              <div>
                <p className="font-medium">Payment Cancelled</p>
                <p className="text-sm text-red-100">Your payment was cancelled.</p>
              </div>
              <button
                onClick={() => setPaymentStatus(null)}
                className="text-red-100 hover:text-white ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Usage Limit Modal */}
      {showLimitModal && getUsageStatus() && (
        <UsageLimitModal
          isOpen={showLimitModal}
          onClose={closeModal}
          currentUsage={getUsageStatus()!.currentUsage}
          usageLimit={getUsageStatus()!.usageLimit}
          currentPlan={getUsageStatus()!.currentPlan}
          overageAmount={getUsageStatus()!.overageAmount}
        />
      )}
    </div>
  );
}