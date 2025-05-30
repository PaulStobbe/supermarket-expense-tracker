import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useRequireAuth } from './hooks/useAuth';
import { PageLoading } from './components/Loading';
import { ErrorBoundary, setupGlobalErrorHandling } from './components/ErrorBoundary';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import ExpenseForm from './pages/ExpenseForm';
import ExpenseDetail from './pages/ExpenseDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

// Create a query client with enhanced configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 60000, // 1 minute
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// Setup global error handling
setupGlobalErrorHandling();

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, shouldRedirect } = useRequireAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (shouldRedirect || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

// Public Route component (redirects to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useRequireAuth();

  if (isLoading) {
    return <PageLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="App min-h-screen bg-gray-50">
            <Routes>
              {/* Public routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              
              {/* Protected routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/expenses" 
                element={
                  <ProtectedRoute>
                    <Expenses />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/expenses/new" 
                element={
                  <ProtectedRoute>
                    <ExpenseForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/expenses/:id" 
                element={
                  <ProtectedRoute>
                    <ExpenseDetail />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/expenses/:id/edit" 
                element={
                  <ProtectedRoute>
                    <ExpenseForm />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch all route - 404 */}
              <Route 
                path="*" 
                element={
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                      <p className="text-gray-600 mb-4">Page not found</p>
                      <button
                        onClick={() => window.history.back()}
                        className="btn btn-primary"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                } 
              />
            </Routes>
            
            {/* Enhanced Toast notifications */}
            <Toaster
              position="top-right"
              containerClassName="mt-4 mr-4"
              toastOptions={{
                duration: 4000,
                className: 'toast',
                success: {
                  className: 'toast-success',
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#FFFFFF',
                  },
                },
                error: {
                  className: 'toast-error',
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#FFFFFF',
                  },
                },
                loading: {
                  className: 'toast-loading',
                },
              }}
            />
          </div>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;