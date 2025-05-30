import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ExpenseService } from '../services/expense';
import { Expense, ExpenseFormData, ExpenseFilters, PaginatedResponse } from '../types';
import { useDebounce } from './usePerformance';

/**
 * Comprehensive hook for managing expenses with advanced filtering and caching
 */
export function useExpenses(initialFilters?: ExpenseFilters) {
  const [filters, setFilters] = useState<ExpenseFilters>({
    page: 1,
    limit: 10,
    sort_by: 'purchase_date',
    sort_order: 'desc',
    ...initialFilters
  });
  
  const queryClient = useQueryClient();
  
  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(filters.store_name || '', 300);
  
  // Memoize query key to prevent unnecessary refetches
  const queryKey = useMemo(() => {
    const filterKey = { ...filters };
    if (filterKey.store_name) {
      filterKey.store_name = debouncedSearch;
    }
    return ['expenses', filterKey];
  }, [filters, debouncedSearch]);

  // Main expenses query
  const {
    data: expensesData,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery<PaginatedResponse<Expense>>({
    queryKey,
    queryFn: () => ExpenseService.getExpenses({ ...filters, store_name: debouncedSearch }),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  // Categories query
  const { data: categories } = useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: ExpenseService.getCategories,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: ExpenseService.createExpense,
    onSuccess: (newExpense) => {
      // Invalidate and refetch expenses
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      
      // Optimistically update the cache
      queryClient.setQueryData<PaginatedResponse<Expense>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          expenses: [newExpense, ...old.expenses.slice(0, -1)],
          pagination: {
            ...old.pagination,
            total: old.pagination.total + 1
          }
        };
      });
      
      toast.success('Expense created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create expense');
    }
  });

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseFormData }) => 
      ExpenseService.updateExpense(id, data),
    onSuccess: (updatedExpense) => {
      // Update the expense in all relevant queries
      queryClient.setQueryData<PaginatedResponse<Expense>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          expenses: old.expenses.map(expense => 
            expense.id === updatedExpense.id ? updatedExpense : expense
          )
        };
      });
      
      // Also update single expense queries
      queryClient.setQueryData(['expenses', updatedExpense.id], updatedExpense);
      
      toast.success('Expense updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update expense');
    }
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: ExpenseService.deleteExpense,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.setQueryData<PaginatedResponse<Expense>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          expenses: old.expenses.filter(expense => expense.id !== deletedId),
          pagination: {
            ...old.pagination,
            total: old.pagination.total - 1
          }
        };
      });
      
      // Remove single expense query
      queryClient.removeQueries({ queryKey: ['expenses', deletedId] });
      
      toast.success('Expense deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete expense');
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: ExpenseService.bulkDeleteExpenses,
    onSuccess: (_, deletedIds) => {
      // Remove from cache
      queryClient.setQueryData<PaginatedResponse<Expense>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          expenses: old.expenses.filter(expense => !deletedIds.includes(expense.id)),
          pagination: {
            ...old.pagination,
            total: old.pagination.total - deletedIds.length
          }
        };
      });
      
      // Remove single expense queries
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: ['expenses', id] });
      });
      
      toast.success(`${deletedIds.length} expenses deleted successfully!`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete expenses');
    }
  });

  // Helper functions
  const updateFilters = useCallback((newFilters: Partial<ExpenseFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 })); // Reset to page 1 when filters change
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 10,
      sort_by: 'purchase_date',
      sort_order: 'desc'
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  const changeSort = useCallback((sort_by: string, sort_order?: 'asc' | 'desc') => {
    setFilters(prev => ({
      ...prev,
      sort_by,
      sort_order: sort_order || (prev.sort_order === 'asc' ? 'desc' : 'asc'),
      page: 1
    }));
  }, []);

  const searchExpenses = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, store_name: query, page: 1 }));
  }, []);

  const filterByCategory = useCallback((category: string) => {
    setFilters(prev => ({ ...prev, category, page: 1 }));
  }, []);

  const filterByDateRange = useCallback((start_date: string, end_date: string) => {
    setFilters(prev => ({ ...prev, start_date, end_date, page: 1 }));
  }, []);

  const filterByAmountRange = useCallback((min_amount: number, max_amount: number) => {
    setFilters(prev => ({ ...prev, min_amount, max_amount, page: 1 }));
  }, []);

  // Computed values
  const hasFilters = useMemo(() => {
    const defaultFilters = ['page', 'limit', 'sort_by', 'sort_order'];
    return Object.keys(filters).some(key => 
      !defaultFilters.includes(key) && 
      filters[key as keyof ExpenseFilters] !== undefined &&
      filters[key as keyof ExpenseFilters] !== ''
    );
  }, [filters]);

  const totalExpenses = expensesData?.pagination.total || 0;
  const currentPage = expensesData?.pagination.page || 1;
  const totalPages = expensesData?.pagination.pages || 1;
  const hasNextPage = expensesData?.pagination.hasNext || false;
  const hasPrevPage = expensesData?.pagination.hasPrev || false;

  return {
    // Data
    expenses: expensesData?.expenses || [],
    categories: categories || [],
    pagination: expensesData?.pagination,
    
    // State
    filters,
    isLoading,
    isFetching,
    error,
    hasFilters,
    
    // Pagination info
    totalExpenses,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    
    // Functions
    refetch,
    updateFilters,
    resetFilters,
    goToPage,
    changeSort,
    searchExpenses,
    filterByCategory,
    filterByDateRange,
    filterByAmountRange,
    
    // Mutations
    createExpense: createExpenseMutation.mutate,
    updateExpense: updateExpenseMutation.mutate,
    deleteExpense: deleteExpenseMutation.mutate,
    bulkDelete: bulkDeleteMutation.mutate,
    
    // Mutation states
    isCreating: createExpenseMutation.isLoading,
    isUpdating: updateExpenseMutation.isLoading,
    isDeleting: deleteExpenseMutation.isLoading,
    isBulkDeleting: bulkDeleteMutation.isLoading,
  };
}

/**
 * Hook for managing a single expense
 */
export function useExpense(id: number) {
  const queryClient = useQueryClient();
  
  const {
    data: expense,
    isLoading,
    error
  } = useQuery<Expense>({
    queryKey: ['expenses', id],
    queryFn: () => ExpenseService.getExpense(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => ExpenseService.updateExpense(id, data),
    onSuccess: (updatedExpense) => {
      queryClient.setQueryData(['expenses', id], updatedExpense);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update expense');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => ExpenseService.deleteExpense(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['expenses', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete expense');
    }
  });

  return {
    expense,
    isLoading,
    error,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
}

export default useExpenses;