import { ExpenseService } from './expenseService';

export interface SpendingPrediction {
  predictedAmount: number;
  confidence: number;
  factors: string[];
  recommendation: string;
}

export interface SpendingInsight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestions: string[];
  data?: any;
}

export interface UserSpendingProfile {
  averageMonthlySpend: number;
  preferredStores: string[];
  topCategories: Array<{ category: string; percentage: number }>;
  spendingPattern: 'consistent' | 'variable' | 'seasonal';
  budgetAdherence: number; // 0-100%
  riskScore: number; // 0-100, higher = more likely to overspend
}

export class AIInsightsService {
  private expenseService: ExpenseService;

  constructor() {
    this.expenseService = new ExpenseService();
  }

  async generateSpendingInsights(userId: number): Promise<SpendingInsight[]> {
    const userExpenses = await this.expenseService.getUserExpenses(userId, { limit: 1000 });
    const profile = await this.generateUserProfile(userId);
    
    const insights: SpendingInsight[] = [];

    // Trend Analysis
    const trendInsight = await this.analyzeTrends(userExpenses);
    if (trendInsight) insights.push(trendInsight);

    // Anomaly Detection
    const anomalies = await this.detectAnomalies(userExpenses);
    insights.push(...anomalies);

    // Seasonal Pattern Recognition
    const seasonalInsight = await this.analyzeSeasonalPatterns(userExpenses);
    if (seasonalInsight) insights.push(seasonalInsight);

    // Store Loyalty Analysis
    const loyaltyInsight = await this.analyzeStoreLoyalty(userExpenses);
    if (loyaltyInsight) insights.push(loyaltyInsight);

    // Category Optimization
    const categoryInsights = await this.analyzeCategoryOptimization(userExpenses);
    insights.push(...categoryInsights);

    // Budget Performance Prediction
    const budgetInsight = await this.predictBudgetPerformance(userId, profile);
    if (budgetInsight) insights.push(budgetInsight);

    return insights.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  async predictNextMonthSpending(userId: number): Promise<SpendingPrediction> {
    const expenses = await this.expenseService.getUserExpenses(userId, { limit: 365 });
    
    // Simple linear regression for prediction
    const monthlyTotals = this.groupExpensesByMonth(expenses);
    const prediction = this.calculateTrendPrediction(monthlyTotals);
    
    const factors = this.identifyPredictionFactors(expenses);
    const recommendation = this.generateSpendingRecommendation(prediction, factors);

    return {
      predictedAmount: prediction.amount,
      confidence: prediction.confidence,
      factors,
      recommendation
    };
  }

  async generateUserProfile(userId: number): Promise<UserSpendingProfile> {
    const expenses = await this.expenseService.getUserExpenses(userId, { limit: 1000 });
    
    if (expenses.length === 0) {
      return {
        averageMonthlySpend: 0,
        preferredStores: [],
        topCategories: [],
        spendingPattern: 'consistent',
        budgetAdherence: 100,
        riskScore: 0
      };
    }

    const monthlyTotals = this.groupExpensesByMonth(expenses);
    const averageMonthlySpend = monthlyTotals.reduce((sum, month) => sum + month.total, 0) / monthlyTotals.length;

    const storeFrequency = this.calculateStoreFrequency(expenses);
    const preferredStores = Object.entries(storeFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([store]) => store);

    const categoryTotals = this.calculateCategoryTotals(expenses);
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const topCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({
        category,
        percentage: (amount / totalSpent) * 100
      }));

    const spendingPattern = this.determineSpendingPattern(monthlyTotals);
    const budgetAdherence = await this.calculateBudgetAdherence(userId);
    const riskScore = this.calculateRiskScore(monthlyTotals, spendingPattern);

    return {
      averageMonthlySpend,
      preferredStores,
      topCategories,
      spendingPattern,
      budgetAdherence,
      riskScore
    };
  }

  private async analyzeTrends(expenses: any[]): Promise<SpendingInsight | null> {
    if (expenses.length < 30) return null;

    const monthlyTotals = this.groupExpensesByMonth(expenses);
    if (monthlyTotals.length < 3) return null;

    const recentTrend = this.calculateTrend(monthlyTotals.slice(-3));
    
    if (Math.abs(recentTrend) < 0.05) return null; // Less than 5% change

    const isIncreasing = recentTrend > 0;
    const percentageChange = Math.abs(recentTrend * 100);

    return {
      type: isIncreasing ? 'warning' : 'opportunity',
      title: isIncreasing ? 'Increasing Spending Trend' : 'Decreasing Spending Trend',
      description: `Your spending has ${isIncreasing ? 'increased' : 'decreased'} by ${percentageChange.toFixed(1)}% over the last 3 months.`,
      impact: percentageChange > 20 ? 'high' : percentageChange > 10 ? 'medium' : 'low',
      actionable: true,
      suggestions: isIncreasing 
        ? [
            'Review your recent purchases to identify unnecessary expenses',
            'Set up budget alerts to monitor spending in real-time',
            'Consider meal planning to reduce impulse purchases'
          ]
        : [
            'Great job reducing your spending!',
            'Consider allocating savings to an emergency fund',
            'Maintain current spending habits for continued savings'
          ],
      data: { trend: recentTrend, monthlyTotals }
    };
  }

  private async detectAnomalies(expenses: any[]): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    
    // Detect unusually large transactions
    const amounts = expenses.map(e => e.amount);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length);
    
    const outliers = expenses.filter(e => e.amount > mean + 2 * stdDev);
    
    if (outliers.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Unusual Large Purchases Detected',
        description: `Found ${outliers.length} transactions significantly above your average spending.`,
        impact: 'medium',
        actionable: true,
        suggestions: [
          'Review these large purchases to ensure they were necessary',
          'Consider if these represent one-time expenses or new spending patterns',
          'Set up alerts for transactions above your comfort threshold'
        ],
        data: { outliers, threshold: mean + 2 * stdDev }
      });
    }

    // Detect frequency anomalies
    const dailyTransactionCounts = this.calculateDailyTransactionFrequency(expenses);
    const unusuallyActiveDays = dailyTransactionCounts.filter(day => day.count > 5);
    
    if (unusuallyActiveDays.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'High Shopping Frequency Days',
        description: `You had ${unusuallyActiveDays.length} days with 5+ transactions.`,
        impact: 'low',
        actionable: true,
        suggestions: [
          'Consider consolidating shopping trips to save time and reduce impulse purchases',
          'Plan shopping lists in advance',
          'Review if multiple trips were necessary'
        ]
      });
    }

    return insights;
  }

  private async analyzeSeasonalPatterns(expenses: any[]): Promise<SpendingInsight | null> {
    const monthlyData = this.groupExpensesByMonth(expenses);
    if (monthlyData.length < 12) return null;

    // Identify seasonal patterns
    const seasonalVariation = this.calculateSeasonalVariation(monthlyData);
    
    if (seasonalVariation.coefficient < 0.1) return null; // No significant variation

    return {
      type: 'trend',
      title: 'Seasonal Spending Pattern Identified',
      description: `Your spending varies by ${(seasonalVariation.coefficient * 100).toFixed(1)}% throughout the year.`,
      impact: 'medium',
      actionable: true,
      suggestions: [
        `Plan for higher spending in ${seasonalVariation.peakMonth}`,
        `Take advantage of lower spending periods to build savings`,
        'Consider seasonal budgets to manage cash flow'
      ],
      data: seasonalVariation
    };
  }

  private async analyzeStoreLoyalty(expenses: any[]): Promise<SpendingInsight | null> {
    const storeData = this.calculateStoreMetrics(expenses);
    const loyaltyScore = this.calculateLoyaltyScore(storeData);
    
    if (loyaltyScore > 0.7) {
      return {
        type: 'opportunity',
        title: 'High Store Loyalty Detected',
        description: `You shop at the same stores ${(loyaltyScore * 100).toFixed(0)}% of the time.`,
        impact: 'medium',
        actionable: true,
        suggestions: [
          'Consider comparing prices at other stores occasionally',
          'Look into store loyalty programs for additional savings',
          'Explore online grocery options for better deals'
        ]
      };
    }

    return null;
  }

  private async analyzeCategoryOptimization(expenses: any[]): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    const categoryData = this.calculateCategoryMetrics(expenses);
    
    // Find categories with high spending but low transaction frequency
    const expensiveCategories = Object.entries(categoryData)
      .filter(([, data]: [string, any]) => data.avgTransaction > 50 && data.frequency < 0.1)
      .sort(([, a], [, b]) => b.avgTransaction - a.avgTransaction);

    if (expensiveCategories.length > 0) {
      const [category, data] = expensiveCategories[0];
      insights.push({
        type: 'opportunity',
        title: `High-Value ${category} Purchases`,
        description: `Your average ${category.toLowerCase()} purchase is $${data.avgTransaction.toFixed(2)}.`,
        impact: 'medium',
        actionable: true,
        suggestions: [
          'Consider buying in bulk for better unit prices',
          'Look for sales and discounts before making large purchases',
          'Compare prices across different brands and stores'
        ]
      });
    }

    return insights;
  }

  private async predictBudgetPerformance(userId: number, profile: UserSpendingProfile): Promise<SpendingInsight | null> {
    if (profile.riskScore < 30) return null;

    return {
      type: 'warning',
      title: 'Budget Risk Assessment',
      description: `Based on your spending patterns, there's a ${profile.riskScore}% risk of exceeding your budgets.`,
      impact: profile.riskScore > 70 ? 'high' : 'medium',
      actionable: true,
      suggestions: [
        'Set up real-time budget alerts',
        'Review and adjust budget amounts if needed',
        'Consider automatic savings transfers to reduce available spending money'
      ]
    };
  }

  // Helper methods for calculations
  private groupExpensesByMonth(expenses: any[]) {
    const groups = expenses.reduce((groups, expense) => {
      const date = new Date(expense.purchase_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[key]) {
        groups[key] = { month: key, total: 0, count: 0 };
      }
      groups[key].total += expense.amount;
      groups[key].count += 1;
      return groups;
    }, {});
    
    return Object.values(groups).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }

  private calculateTrend(monthlyTotals: any[]) {
    if (monthlyTotals.length < 2) return 0;
    const first = monthlyTotals[0].total;
    const last = monthlyTotals[monthlyTotals.length - 1].total;
    return (last - first) / first;
  }

  private calculateTrendPrediction(monthlyTotals: any[]) {
    // Simple linear regression implementation
    const n = monthlyTotals.length;
    if (n < 3) return { amount: 0, confidence: 0 };

    const x = monthlyTotals.map((_, i) => i);
    const y = monthlyTotals.map(m => m.total);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictedAmount = slope * n + intercept;
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const totalSS = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSS = y.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSS / totalSS);

    return {
      amount: Math.max(0, predictedAmount),
      confidence: Math.max(0, Math.min(100, rSquared * 100))
    };
  }

  private identifyPredictionFactors(expenses: any[]): string[] {
    const factors = [];
    
    // Analyze recent spending patterns
    const recentExpenses = expenses.slice(0, 30);
    const olderExpenses = expenses.slice(30, 60);
    
    if (recentExpenses.length && olderExpenses.length) {
      const recentAvg = recentExpenses.reduce((sum, e) => sum + e.amount, 0) / recentExpenses.length;
      const olderAvg = olderExpenses.reduce((sum, e) => sum + e.amount, 0) / olderExpenses.length;
      
      const change = (recentAvg - olderAvg) / olderAvg;
      
      if (change > 0.1) factors.push('Recent increase in average transaction size');
      if (change < -0.1) factors.push('Recent decrease in average transaction size');
    }

    // Check for seasonal factors
    const currentMonth = new Date().getMonth();
    if ([10, 11].includes(currentMonth)) factors.push('Holiday season spending');
    if ([0, 1].includes(currentMonth)) factors.push('Post-holiday spending normalization');

    return factors;
  }

  private generateSpendingRecommendation(prediction: any, factors: string[]): string {
    if (prediction.confidence < 50) {
      return 'Prediction confidence is low. Continue monitoring your spending patterns.';
    }

    if (factors.some(f => f.includes('increase'))) {
      return 'Consider reviewing your recent spending to identify areas for optimization.';
    }

    return 'Your spending patterns appear stable. Maintain current habits for consistent financial health.';
  }

  private calculateStoreFrequency(expenses: any[]) {
    return expenses.reduce((freq, expense) => {
      freq[expense.store] = (freq[expense.store] || 0) + 1;
      return freq;
    }, {});
  }

  private calculateCategoryTotals(expenses: any[]) {
    return expenses.reduce((totals, expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
      return totals;
    }, {});
  }

  private determineSpendingPattern(monthlyTotals: any[]): 'consistent' | 'variable' | 'seasonal' {
    if (monthlyTotals.length < 3) return 'consistent';
    
    const amounts = monthlyTotals.map(m => m.total);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    if (coefficientOfVariation < 0.15) return 'consistent';
    if (coefficientOfVariation > 0.3) return 'variable';
    return 'seasonal';
  }

  private async calculateBudgetAdherence(userId: number): Promise<number> {
    // This would integrate with the budget service
    // For now, return a placeholder
    return 75;
  }

  private calculateRiskScore(monthlyTotals: any[], pattern: string): number {
    let baseScore = 0;
    
    // Pattern-based risk
    if (pattern === 'variable') baseScore += 30;
    if (pattern === 'seasonal') baseScore += 15;
    
    // Recent trend risk
    if (monthlyTotals.length >= 3) {
      const recentTrend = this.calculateTrend(monthlyTotals.slice(-3));
      if (recentTrend > 0.2) baseScore += 25; // 20%+ increase
      if (recentTrend > 0.1) baseScore += 15; // 10%+ increase
    }
    
    return Math.min(100, baseScore);
  }

  private calculateSeasonalVariation(monthlyData: any[]) {
    // Simplified seasonal analysis
    const amounts = monthlyData.map(m => m.total);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    
    const coefficient = (maxAmount - minAmount) / mean;
    
    const peakMonthIndex = amounts.indexOf(maxAmount);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
    
    return {
      coefficient,
      peakMonth: monthNames[peakMonthIndex % 12],
      peakAmount: maxAmount,
      minAmount
    };
  }

  private calculateStoreMetrics(expenses: any[]) {
    // Implementation for store loyalty calculations
    return {};
  }

  private calculateLoyaltyScore(storeData: any): number {
    // Implementation for loyalty score calculation
    return 0.5;
  }

  private calculateCategoryMetrics(expenses: any[]) {
    const metrics = {};
    
    expenses.forEach(expense => {
      if (!metrics[expense.category]) {
        metrics[expense.category] = {
          total: 0,
          count: 0,
          avgTransaction: 0,
          frequency: 0
        };
      }
      
      metrics[expense.category].total += expense.amount;
      metrics[expense.category].count += 1;
    });
    
    const totalTransactions = expenses.length;
    
    Object.keys(metrics).forEach(category => {
      const data = metrics[category];
      data.avgTransaction = data.total / data.count;
      data.frequency = data.count / totalTransactions;
    });
    
    return metrics;
  }

  private calculateDailyTransactionFrequency(expenses: any[]) {
    const daily = expenses.reduce((groups, expense) => {
      const date = expense.purchase_date.split('T')[0];
      if (!groups[date]) {
        groups[date] = { date, count: 0 };
      }
      groups[date].count += 1;
      return groups;
    }, {});
    
    return Object.values(daily);
  }
}
