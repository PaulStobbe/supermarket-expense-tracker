import api, { handleApiResponse, handleApiError } from './api';
import { AnalyticsSummary, TrendData, CategoryAnalysis } from '../types';

export class AnalyticsService {
  // Get analytics summary
  static async getSummary(params?: {
    period?: 'week' | 'month' | 'year';
    start_date?: string;
    end_date?: string;
  }): Promise<AnalyticsSummary> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) {
            searchParams.append(key, value);
          }
        });
      }
      
      const response = await api.get(`/api/analytics/summary?${searchParams.toString()}`);
      return handleApiResponse<AnalyticsSummary>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get spending trends
  static async getTrends(params?: {
    period?: 'daily' | 'weekly' | 'monthly';
    days?: number;
  }): Promise<TrendData[]> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) {
            searchParams.append(key, value.toString());
          }
        });
      }
      
      const response = await api.get(`/api/analytics/trends?${searchParams.toString()}`);
      return handleApiResponse<TrendData[]>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get category analysis
  static async getCategoryAnalysis(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<CategoryAnalysis[]> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) {
            searchParams.append(key, value);
          }
        });
      }
      
      const response = await api.get(`/api/analytics/categories?${searchParams.toString()}`);
      return handleApiResponse<CategoryAnalysis[]>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get dashboard insights
  static async getDashboardInsights(): Promise<{
    totalSpent: number;
    monthlyAverage: number;
    topCategory: { name: string; amount: number };
    topStore: { name: string; amount: number };
    recentTrend: 'up' | 'down' | 'stable';
    budgetStatus?: { used: number; total: number; percentage: number };
  }> {
    try {
      const response = await api.get('/api/analytics/insights');
      return handleApiResponse(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get spending comparison
  static async getSpendingComparison(params: {
    currentPeriod: { start: string; end: string };
    previousPeriod: { start: string; end: string };
  }): Promise<{
    current: { amount: number; count: number };
    previous: { amount: number; count: number };
    change: { amount: number; percentage: number; direction: 'up' | 'down' | 'same' };
  }> {
    try {
      const response = await api.post('/api/analytics/comparison', params);
      return handleApiResponse(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }
}

export default AnalyticsService;