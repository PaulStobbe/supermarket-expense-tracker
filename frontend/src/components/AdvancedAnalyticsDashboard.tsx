import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
  RadialBarChart, RadialBar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { BudgetAlert, BudgetAnalysis } from '../../types/budget';
import { useBudgets, useExpenseAnalytics } from '../../hooks/useAnalytics';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export const AdvancedAnalyticsDashboard: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  
  const { data: budgetAnalysis, isLoading: budgetLoading } = useBudgets();
  const { data: expenseAnalytics, isLoading: analyticsLoading } = useExpenseAnalytics(selectedPeriod);

  const budgetAlerts = budgetAnalysis?.budgetPerformance?.filter(
    budget => budget.status === 'warning' || budget.status === 'over'
  ) || [];

  if (budgetLoading || analyticsLoading) {
    return <div className="flex items-center justify-center h-64">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter', 'year'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'primary' : 'outline'}
              onClick={() => setSelectedPeriod(period)}
              className="capitalize"
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Budget Alerts</h3>
          {budgetAlerts.map((alert) => (
            <Alert 
              key={alert.budgetId} 
              variant={alert.status === 'over' ? 'destructive' : 'warning'}
            >
              <AlertDescription>
                <div className="flex justify-between items-center">
                  <span>
                    {alert.name}: ${alert.spent.toFixed(2)} / ${alert.budgetAmount.toFixed(2)} 
                    ({alert.percentageUsed.toFixed(1)}% used)
                  </span>
                  <Badge variant={alert.status === 'over' ? 'destructive' : 'warning'}>
                    {alert.status === 'over' ? 'Over Budget' : 'Warning'}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${expenseAnalytics?.totalSpent?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-gray-600">
              {expenseAnalytics?.percentageChange && (
                <span className={expenseAnalytics.percentageChange > 0 ? 'text-red-600' : 'text-green-600'}>
                  {expenseAnalytics.percentageChange > 0 ? '↑' : '↓'} 
                  {Math.abs(expenseAnalytics.percentageChange).toFixed(1)}%
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Budgets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{budgetAnalysis?.activeBudgets || 0}</div>
            <p className="text-xs text-gray-600">
              ${budgetAnalysis?.totalBudgetAmount?.toFixed(2) || '0.00'} allocated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Budget Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${budgetAnalysis?.savings?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-gray-600">Money saved this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg per Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${expenseAnalytics?.averageTransaction?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-gray-600">
              {expenseAnalytics?.totalTransactions || 0} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Trends */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending Trends Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={expenseAnalytics?.trendData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseAnalytics?.categoryBreakdown || []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(expenseAnalytics?.categoryBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart data={budgetAnalysis?.budgetPerformance || []}>
                <RadialBar
                  dataKey="percentageUsed"
                  cornerRadius={10}
                  fill="#8884d8"
                />
                <Tooltip 
                  formatter={(value, name, props) => [
                    `${value}%`, 
                    `${props.payload.name} Budget Used`
                  ]} 
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Store Comparison */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Store Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseAnalytics?.storeBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                <Legend />
                <Bar dataKey="amount" fill="#82ca9d" />
                <Bar dataKey="transactionCount" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => setShowBudgetModal(true)}>
          Create New Budget
        </Button>
        <Button variant="outline">
          Export Report
        </Button>
        <Button variant="outline">
          Set Up Alerts
        </Button>
      </div>

      {/* Budget Creation Modal */}
      {showBudgetModal && (
        <Modal onClose={() => setShowBudgetModal(false)}>
          <CreateBudgetForm onSuccess={() => setShowBudgetModal(false)} />
        </Modal>
      )}
    </div>
  );
};

// Budget Creation Form Component
const CreateBudgetForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    period: 'monthly' as const,
    alertThreshold: '80'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation for creating budget
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold">Create New Budget</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Budget Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount</label>
        <input
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Category (Optional)</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="Groceries">Groceries</option>
          <option value="Household">Household</option>
          <option value="Personal Care">Personal Care</option>
          {/* Add other categories */}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Period</label>
        <select
          value={formData.period}
          onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Alert Threshold (%)</label>
        <input
          type="number"
          min="50"
          max="100"
          value={formData.alertThreshold}
          onChange={(e) => setFormData({ ...formData, alertThreshold: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit">Create Budget</Button>
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
