// API specific types

export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
  path?: string;
  method?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  data: {
    items: T[];
    pagination: PaginationMeta;
  };
}

export interface SortOptions {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface FilterOptions {
  search?: string;
  filters?: Record<string, any>;
}

export interface QueryOptions extends SortOptions, FilterOptions {
  page?: number;
  limit?: number;
}

// Specific API endpoint types
export interface AuthApiResponse {
  user: {
    id: number;
    email: string;
    name: string;
    picture?: string;
  };
  token?: string;
}

export interface ExpenseApiResponse {
  id: number;
  store_name: string;
  category: string;
  amount: number;
  description?: string;
  purchase_date: string;
  receipt_url?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CategoryApiResponse {
  name: string;
  color: string;
  icon: string;
}

export interface AnalyticsApiResponse {
  summary: {
    totalCount: number;
    totalAmount: number;
    averageAmount: number;
  };
  categories: Array<{
    category: string;
    count: number;
    total: number;
    percentage: string;
  }>;
  trends: Array<{
    period: string;
    count: number;
    total: number;
    average: number;
  }>;
}

export interface UserApiResponse {
  id: number;
  email: string;
  name: string;
  picture?: string;
  preferences: {
    currency: string;
    timezone: string;
    notifications: {
      email: boolean;
      weeklySummary: boolean;
      budgetAlerts: boolean;
    };
  };
  stats: {
    totalExpenses: number;
    totalSpent: number;
    averageExpense: number;
  };
}