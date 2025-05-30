import { z } from 'zod';

// Form validation schemas using Zod
export const ExpenseFormSchema = z.object({
  store_name: z.string().min(1, 'Store name is required').max(100, 'Store name must be less than 100 characters'),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  receipt_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tags: z.array(z.string()).optional()
});

export const UserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  timezone: z.string().min(1, 'Timezone is required'),
  notifications: z.object({
    email: z.boolean(),
    weeklySummary: z.boolean(),
    budgetAlerts: z.boolean()
  }).optional()
});

export const FilterFormSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  store_name: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  min_amount: z.number().min(0).optional(),
  max_amount: z.number().min(0).optional(),
  sort_by: z.enum(['purchase_date', 'amount', 'store_name', 'category', 'created_at']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional()
});

// Form types derived from schemas
export type ExpenseFormData = z.infer<typeof ExpenseFormSchema>;
export type UserProfileData = z.infer<typeof UserProfileSchema>;
export type FilterFormData = z.infer<typeof FilterFormSchema>;

// Form field types
export interface FormFieldError {
  message: string;
  type: string;
}

export interface FormState<T> {
  data: T;
  errors: Partial<Record<keyof T, FormFieldError>>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface FormFieldProps<T = any> {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  value?: T;
  onChange?: (value: T) => void;
  onBlur?: () => void;
}

export interface SelectFieldProps extends FormFieldProps<string> {
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  multiple?: boolean;
}

export interface DateFieldProps extends FormFieldProps<string> {
  minDate?: string;
  maxDate?: string;
  format?: string;
}

export interface NumberFieldProps extends FormFieldProps<number> {
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export interface TextAreaFieldProps extends FormFieldProps<string> {
  rows?: number;
  maxLength?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

// Form validation types
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  validate?: (value: any) => boolean | string;
}

export interface FormValidationSchema {
  [fieldName: string]: ValidationRule;
}

// Form hook types
export interface UseFormOptions<T> {
  defaultValues?: Partial<T>;
  validationSchema?: z.ZodSchema<T>;
  onSubmit?: (data: T) => void | Promise<void>;
  resetOnSubmit?: boolean;
}

export interface UseFormReturn<T> {
  register: (name: keyof T) => {
    name: keyof T;
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    error?: string;
  };
  handleSubmit: (onSubmit: (data: T) => void) => (e?: React.FormEvent) => void;
  watch: (name?: keyof T) => any;
  setValue: (name: keyof T, value: any) => void;
  reset: (data?: Partial<T>) => void;
  formState: FormState<T>;
  trigger: (name?: keyof T) => Promise<boolean>;
}