// Chart and visualization types

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface LineChartDataPoint {
  name: string;
  [dataKey: string]: string | number;
}

export interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

export interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

// Chart configuration types
export interface ChartConfig {
  width?: number;
  height?: number;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  responsive?: boolean;
  animation?: boolean;
}

export interface LineChartConfig extends ChartConfig {
  dataKey: string;
  strokeWidth?: number;
  strokeColor?: string;
  dot?: boolean;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
}

export interface PieChartConfig extends ChartConfig {
  innerRadius?: number;
  outerRadius?: number;
  paddingAngle?: number;
  dataKey?: string;
  nameKey?: string;
  legend?: boolean;
  tooltip?: boolean;
  labelLine?: boolean;
}

export interface BarChartConfig extends ChartConfig {
  dataKey: string;
  barSize?: number;
  fill?: string;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  horizontal?: boolean;
}

// Chart component props
export interface ChartProps {
  data: ChartDataPoint[];
  config?: ChartConfig;
  className?: string;
  loading?: boolean;
  error?: string;
}

export interface LineChartProps {
  data: LineChartDataPoint[];
  config?: LineChartConfig;
  className?: string;
  loading?: boolean;
  error?: string;
}

export interface PieChartProps {
  data: PieChartDataPoint[];
  config?: PieChartConfig;
  className?: string;
  loading?: boolean;
  error?: string;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  config?: BarChartConfig;
  className?: string;
  loading?: boolean;
  error?: string;
}

// Chart utility types
export interface ChartTooltipPayload {
  color?: string;
  dataKey?: string;
  name?: string;
  payload?: any;
  value?: any;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

export interface ChartLegendProps {
  payload?: Array<{
    value: string;
    type: string;
    color: string;
    dataKey: string;
  }>;
}

// Color palette types
export interface ColorPalette {
  primary: string[];
  secondary: string[];
  categorical: string[];
  sequential: string[];
  diverging: string[];
}

export interface ChartTheme {
  colors: ColorPalette;
  fonts: {
    family: string;
    size: {
      small: number;
      medium: number;
      large: number;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

// Analytics specific chart types
export interface ExpenseTrendData {
  date: string;
  amount: number;
  count: number;
  average: number;
}

export interface CategoryBreakdownData {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
  icon?: string;
}

export interface MonthlyComparisonData {
  month: string;
  currentYear: number;
  previousYear?: number;
  difference?: number;
  percentageChange?: number;
}

export interface StoreAnalysisData {
  store: string;
  amount: number;
  count: number;
  averagePerVisit: number;
  lastVisit: string;
}

// Dashboard specific types
export interface DashboardMetric {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

export interface DashboardChartWidget {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartDataPoint[];
  config?: ChartConfig;
  size: 'small' | 'medium' | 'large';
  refreshInterval?: number;
}

export interface DashboardLayout {
  widgets: DashboardChartWidget[];
  layout: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}