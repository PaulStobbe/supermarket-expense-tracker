import api, { handleApiResponse, handleApiError } from './api';
import { User, UserPreferences, UserStats } from '../types';

export class UserService {
  // Get user profile
  static async getProfile(): Promise<User & { preferences: UserPreferences }> {
    try {
      const response = await api.get('/api/user/profile');
      return handleApiResponse<User & { preferences: UserPreferences }>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Update user profile
  static async updateProfile(data: {
    name?: string;
    currency?: string;
    timezone?: string;
    notifications?: {
      email?: boolean;
      weeklySummary?: boolean;
      budgetAlerts?: boolean;
    };
  }): Promise<User & { preferences: UserPreferences }> {
    try {
      const response = await api.put('/api/user/profile', data);
      return handleApiResponse<User & { preferences: UserPreferences }>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get user statistics
  static async getStats(): Promise<UserStats> {
    try {
      const response = await api.get('/api/user/stats');
      return handleApiResponse<UserStats>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Delete user account
  static async deleteAccount(): Promise<void> {
    try {
      await api.delete('/api/user/account');
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Export user data
  static async exportData(): Promise<string> {
    try {
      const response = await api.get('/api/user/export', {
        responseType: 'blob'
      });
      
      // Create download URL
      const url = window.URL.createObjectURL(new Blob([response.data]));
      return url;
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Change password (if implementing local auth in future)
  static async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    try {
      await api.post('/api/user/change-password', data);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Update notification preferences
  static async updateNotificationPreferences(notifications: {
    email: boolean;
    weeklySummary: boolean;
    budgetAlerts: boolean;
  }): Promise<void> {
    try {
      await api.put('/api/user/notifications', { notifications });
    } catch (error: any) {
      throw handleApiError(error);
    }
  }
}

export default UserService;