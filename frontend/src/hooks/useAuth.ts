import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AuthService } from '../services/auth';
import { User, AuthStatus } from '../types';

/**
 * Enhanced authentication hook with comprehensive state management
 */
export function useAuth() {
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Query for authentication status
  const {
    data: authStatus,
    isLoading,
    error,
    refetch
  } = useQuery<AuthStatus>({
    queryKey: ['auth', 'status'],
    queryFn: AuthService.getAuthStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
    onSuccess: () => {
      setIsInitialized(true);
    },
    onError: () => {
      setIsInitialized(true);
    }
  });

  // Query for current user (only when authenticated)
  const {
    data: user,
    isLoading: isUserLoading
  } = useQuery<User>({
    queryKey: ['auth', 'user'],
    queryFn: AuthService.getCurrentUser,
    enabled: authStatus?.authenticated || false,
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: AuthService.logout,
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
      // Navigate to login
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    },
    onError: (error: any) => {
      console.error('Logout error:', error);
      // Force navigation even if logout fails
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  });

  // Token refresh mutation
  const refreshTokenMutation = useMutation({
    mutationFn: AuthService.refreshToken,
    onSuccess: () => {
      // Refetch auth status and user
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: () => {
      // If refresh fails, logout
      logout();
    }
  });

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const authParam = urlParams.get('auth');
    const errorParam = urlParams.get('error');

    if (authParam === 'success') {
      // OAuth success - refetch auth status
      refetch();
      // Clean up URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      toast.success('Successfully logged in!');
    } else if (errorParam) {
      // OAuth error
      const errorMessages: Record<string, string> = {
        oauth_failed: 'Google authentication failed',
        no_user: 'No user information received',
        callback_failed: 'Authentication callback failed'
      };
      
      const message = errorMessages[errorParam] || 'Authentication failed';
      toast.error(message);
      
      // Clean up URL
      navigate('/login', { replace: true });
    }
  }, [location.search, refetch, navigate]);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (authStatus?.authenticated) {
      // Set up token refresh 5 minutes before expiration
      const refreshInterval = setInterval(() => {
        refreshTokenMutation.mutate();
      }, 25 * 60 * 1000); // Refresh every 25 minutes (assuming 30 min expiration)

      return () => clearInterval(refreshInterval);
    }
  }, [authStatus?.authenticated, refreshTokenMutation]);

  // Functions
  const login = useCallback(() => {
    // Store current location for redirect after login
    const currentPath = location.pathname + location.search;
    if (currentPath !== '/' && currentPath !== '/login') {
      AuthService.setRedirectUrl(currentPath);
    }
    
    AuthService.initiateGoogleAuth();
  }, [location]);

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const refreshToken = useCallback(() => {
    refreshTokenMutation.mutate();
  }, [refreshTokenMutation]);

  const checkAuthStatus = useCallback(() => {
    return refetch();
  }, [refetch]);

  return {
    // State
    isAuthenticated: authStatus?.authenticated || false,
    user: user || null,
    isLoading: isLoading || isUserLoading,
    isInitialized,
    error,
    
    // Functions
    login,
    logout,
    refreshToken,
    checkAuthStatus,
    
    // Mutation states
    isLoggingOut: logoutMutation.isLoading,
    isRefreshing: refreshTokenMutation.isLoading,
  };
}

/**
 * Hook for components that require authentication
 */
export function useRequireAuth() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (auth.isInitialized && !auth.isAuthenticated && !auth.isLoading) {
      // Store current location for redirect after login
      const currentPath = location.pathname + location.search;
      if (currentPath !== '/' && currentPath !== '/login') {
        AuthService.setRedirectUrl(currentPath);
      }
      
      setShouldRedirect(true);
    } else if (auth.isAuthenticated) {
      setShouldRedirect(false);
    }
  }, [auth.isInitialized, auth.isAuthenticated, auth.isLoading, location]);

  return {
    ...auth,
    shouldRedirect
  };
}

/**
 * Hook for protecting routes that should only be accessible to guests
 */
export function useRequireGuest() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (auth.isInitialized && auth.isAuthenticated) {
      // Get redirect URL or default to dashboard
      const redirectUrl = AuthService.getAndClearRedirectUrl();
      navigate(redirectUrl, { replace: true });
      setShouldRedirect(true);
    } else {
      setShouldRedirect(false);
    }
  }, [auth.isInitialized, auth.isAuthenticated, navigate]);

  return {
    ...auth,
    shouldRedirect
  };
}

/**
 * Hook for managing user session with automatic cleanup
 */
export function useSession() {
  const auth = useAuth();
  const [sessionData, setSessionData] = useState<any>(null);

  // Store session data
  useEffect(() => {
    if (auth.user) {
      setSessionData({
        userId: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        loginTime: new Date().toISOString()
      });
    } else {
      setSessionData(null);
    }
  }, [auth.user]);

  // Auto logout on tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionData) {
        // Store session state for potential recovery
        localStorage.setItem('session_backup', JSON.stringify(sessionData));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionData]);

  return {
    ...auth,
    sessionData,
    sessionDuration: sessionData ? 
      Math.floor((new Date().getTime() - new Date(sessionData.loginTime).getTime()) / 1000) : 
      0
  };
}

export default useAuth;