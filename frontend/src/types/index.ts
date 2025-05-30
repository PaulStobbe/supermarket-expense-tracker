// User types
export interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: User | null;
}

export interface UserPreferences {
  currency: string;
  timezone: string;
  notifications: {
    email: boolean;
    weeklySummary: boolean;
    budgetAlerts: boolean;
  };
}

export interface UserStats {
  totalExpenses: number;
  totalSpent: number;
  averageExpense: number;
  categoriesUsed: number;
  storesVisited: number;
  firstExpenseDate?: string;
  lastExpenseDate?: string;
  thisMonth: {
    expenses: number;
    spent: number;
  };
}

// Expense types
export interface Expense {
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

export interface ExpenseFormData {
  store_name: string;
  category: string;
  amount: number;
  description?: string;
  purchase_date: string;
  receipt_url?: string;
  tags?: string[];
}

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  category?: string;
  store_name?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  sort_by?: 'purchase_date' | 'amount' | 'store_name' | 'category' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  expenses: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Category types
export interface Category {
  name: string;
  color: string;
  icon: string;
}

// Analytics types
export interface AnalyticsSummary {
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
  topStores: Array<{
    store_name: string;
    count: number;
    total: number;
  }>;
  recentExpenses: Array<{
    id: number;
    store_name: string;
    category: string;
    amount: number;
    purchase_date: string;
    description?: string;
  }>;
}

export interface TrendData {
  period: string;
  count: number;
  total: number;
  average: number;
}

export interface CategoryAnalysis {
  category: string;
  color?: string;
  icon?: string;
  transaction_count: number;
  total_amount: number;
  average_amount: number;
  min_amount: number;
  max_amount: number;
  percentage: string;
}

// Form types
export interface FormField {
  label: string;
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
}

// UI types
export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// Chart types
export interface ChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface LineChartData {
  name: string;
  [key: string]: any;
}

// Filter types
export interface FilterState {
  search: string;
  category: string;
  dateRange: {
    start: string;
    end: string;
  };
  amountRange: {
    min: number;
    max: number;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  timestamp: string;
}

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

// Navigation types
export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  current?: boolean;
  badge?: string | number;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

// Hook types
export interface UseQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
}

export interface UseMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onSettled?: () => void;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'date';
  placeholder?: string;
  value?: string | number;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Utility types
export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Export all types as a namespace
export * from './api';
export * from './forms';
export * from './charts';

// Default export for convenience
export default {
  // Re-export commonly used types
  User,
  Expense,
  Category,
  AnalyticsSummary,
  ExpenseFilters,
};