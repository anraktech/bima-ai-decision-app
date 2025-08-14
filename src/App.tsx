import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BillingProvider } from './contexts/BillingContext';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Models } from './pages/Models';
import { CreateModel } from './pages/CreateModel';
import { EditModel } from './pages/EditModel';
import { Profile } from './pages/Profile';
import { Community } from './pages/Community';
import { LiveViewer } from './pages/LiveViewer';
import { Landing } from './pages/Landing';
import { Multiplayer } from './pages/Multiplayer';
import { MultiplayerConversation } from './pages/MultiplayerConversation';
import { MultiplayerArena } from './pages/MultiplayerArena';
import { MultiplayerViewer } from './pages/MultiplayerViewer';
import { MaxMode } from './pages/MaxMode';
import { MaxConversation } from './pages/MaxConversation';
import { Billing } from './pages/Billing';
import { Admin4921 } from './pages/Admin4921';
import { PageTransition } from './components/PageTransition';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return !user ? <>{children}</> : <Navigate to="/dashboard" />;
}

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : <Navigate to="/landing" />;
}

function App() {
  console.log('App component rendering');
  return (
    <Router>
      <AuthProvider>
        <BillingProvider>
          <PageTransition>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/signup" element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              } />
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/models" element={
                <PrivateRoute>
                  <Models />
                </PrivateRoute>
              } />
              <Route path="/models/create" element={
                <PrivateRoute>
                  <CreateModel />
                </PrivateRoute>
              } />
              <Route path="/models/:id/edit" element={
                <PrivateRoute>
                  <EditModel />
                </PrivateRoute>
              } />
              <Route path="/community" element={
                <PrivateRoute>
                  <Community />
                </PrivateRoute>
              } />
              <Route path="/live/:shareCode" element={
                <PrivateRoute>
                  <LiveViewer />
                </PrivateRoute>
              } />
              <Route path="/profile" element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } />
              <Route path="/multiplayer" element={
                <PrivateRoute>
                  <Multiplayer />
                </PrivateRoute>
              } />
              <Route path="/multiplayer/conversation" element={
                <PrivateRoute>
                  <MultiplayerConversation />
                </PrivateRoute>
              } />
              <Route path="/multiplayer/arena" element={
                <PrivateRoute>
                  <MultiplayerArena />
                </PrivateRoute>
              } />
              <Route path="/multiplayer/viewer" element={
                <PrivateRoute>
                  <MultiplayerViewer />
                </PrivateRoute>
              } />
              <Route path="/max-mode" element={
                <PrivateRoute>
                  <MaxMode />
                </PrivateRoute>
              } />
              <Route path="/max-conversation" element={
                <PrivateRoute>
                  <MaxConversation />
                </PrivateRoute>
              } />
              <Route path="/billing" element={
                <PrivateRoute>
                  <Billing />
                </PrivateRoute>
              } />
              <Route path="/admin4921" element={<Admin4921 />} />
            </Routes>
          </PageTransition>
        </BillingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;