import api, { handleApiResponse, handleApiError } from './api';
import { Expense, ExpenseFormData, ExpenseFilters, PaginatedResponse } from '../types';

export class ExpenseService {
  // Get expenses with filters and pagination
  static async getExpenses(filters?: ExpenseFilters): Promise<PaginatedResponse<Expense>> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }
      
      const response = await api.get(`/api/expenses?${params.toString()}`);
      return handleApiResponse<PaginatedResponse<Expense>>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get single expense by ID
  static async getExpense(id: number): Promise<Expense> {
    try {
      const response = await api.get(`/api/expenses/${id}`);
      return handleApiResponse<Expense>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Create new expense
  static async createExpense(data: ExpenseFormData): Promise<Expense> {
    try {
      const response = await api.post('/api/expenses', data);
      return handleApiResponse<Expense>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Update expense
  static async updateExpense(id: number, data: ExpenseFormData): Promise<Expense> {
    try {
      const response = await api.put(`/api/expenses/${id}`, data);
      return handleApiResponse<Expense>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Delete expense
  static async deleteExpense(id: number): Promise<void> {
    try {
      await api.delete(`/api/expenses/${id}`);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get expense categories
  static async getCategories(): Promise<Array<{ name: string; color: string; icon: string }>> {
    try {
      const response = await api.get('/api/expenses/categories/list');
      return handleApiResponse<Array<{ name: string; color: string; icon: string }>>(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Export expenses to CSV
  static async exportExpenses(filters?: ExpenseFilters): Promise<string> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }
      
      const response = await api.get(`/api/expenses/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download URL
      const url = window.URL.createObjectURL(new Blob([response.data]));
      return url;
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Bulk delete expenses
  static async bulkDeleteExpenses(ids: number[]): Promise<void> {
    try {
      await api.post('/api/expenses/bulk-delete', { ids });
    } catch (error: any) {
      throw handleApiError(error);
    }
  }

  // Get expense statistics
  static async getExpenseStats(): Promise<{
    totalExpenses: number;
    totalAmount: number;
    averageAmount: number;
    thisMonth: { expenses: number; amount: number };
  }> {
    try {
      const response = await api.get('/api/expenses/stats');
      return handleApiResponse(response);
    } catch (error: any) {
      throw handleApiError(error);
    }
  }
}

export default ExpenseService;