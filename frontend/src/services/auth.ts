import api, { handleApiResponse, handleApiError } from './api';
import { User, AuthStatus } from '../types';

export class AuthService {
  // Get current authentication status
  static async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await api.get('/auth/status');
      return handleApiResponse<AuthStatus>(response);
    } catch (error: any) {
      return {
        authenticated: false,
        user: null,
      };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get('/auth/user');
      return handleApiResponse<User>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Initiate Google OAuth
  static initiateGoogleAuth(): void {
    window.location.href = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/auth/google`;
  }

  // Logout user
  static async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('auth_token');
      // Redirect to login page
      window.location.href = '/login';
    } catch (error: any) {
      handleApiError(error);
    }
  }

  // Refresh token
  static async refreshToken(): Promise<{ token: string }> {
    try {
      const response = await api.post('/auth/refresh');
      const data = handleApiResponse<{ token: string; message: string }>(response);
      
      // Store new token in localStorage as backup
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      return { token: data.token };
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Check if user is authenticated (client-side check)
  static isAuthenticated(): boolean {
    // This is a simple client-side check
    // The real authentication is handled by the server via cookies
    const token = localStorage.getItem('auth_token');
    const authQuery = new URLSearchParams(window.location.search).get('auth');
    
    return !!(token || authQuery === 'success');
  }

  // Handle OAuth callback
  static handleOAuthCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const error = urlParams.get('error');

    if (error) {
      let errorMessage = 'Authentication failed';
      switch (error) {
        case 'oauth_failed':
          errorMessage = 'Google OAuth authentication failed';
          break;
        case 'no_user':
          errorMessage = 'No user information received from Google';
          break;
        case 'callback_failed':
          errorMessage = 'Authentication callback failed';
          break;
        default:
          errorMessage = 'Authentication error occurred';
      }
      
      // Show error message and redirect to login
      setTimeout(() => {
        window.location.href = '/login?error=' + encodeURIComponent(errorMessage);
      }, 100);
      return;
    }

    if (authStatus === 'success') {
      // Clean up URL and redirect to dashboard
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Small delay to ensure cookie is set
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);
    }
  }

  // Get redirect URL after login
  static getRedirectUrl(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }
    
    return '/dashboard';
  }

  // Set redirect URL for after login
  static setRedirectUrl(url: string): void {
    if (url && url !== '/login' && url !== '/') {
      localStorage.setItem('auth_redirect', url);
    }
  }

  // Get and clear redirect URL
  static getAndClearRedirectUrl(): string {
    const redirect = localStorage.getItem('auth_redirect') || '/dashboard';
    localStorage.removeItem('auth_redirect');
    return redirect;
  }
}

export default AuthService;