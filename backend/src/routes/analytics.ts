import express from 'express';
import { query, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, formatValidationErrors, HttpStatus } from '../middleware/errorHandler';
import { getDatabase } from '../services/database';

const router = express.Router();

// @desc    Get expense summary
// @route   GET /api/analytics/summary
// @access  Private
router.get('/summary', [
  query('period').optional().isIn(['week', 'month', 'year']).withMessage('Period must be week, month, or year'),
  query('start_date').optional().isISO8601().withMessage('Start date must be valid'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid')
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      errors: formatValidationErrors(errors.array())
    });
  }

  const db = getDatabase();
  const userId = req.user.id;
  const period = req.query.period as string || 'month';
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;

  // Build date filter
  let dateFilter = '';
  const queryParams: any[] = [userId];

  if (startDate && endDate) {
    dateFilter = 'AND purchase_date BETWEEN ? AND ?';
    queryParams.push(startDate, endDate);
  } else {
    // Use predefined periods
    const now = new Date();
    let periodStart: Date;
    
    switch (period) {
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    dateFilter = 'AND purchase_date >= ?';
    queryParams.push(periodStart.toISOString().split('T')[0]);
  }

  // Get total expenses
  const totalQuery = `
    SELECT 
      COUNT(*) as total_count,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(AVG(amount), 0) as average_amount
    FROM expenses 
    WHERE user_id = ? ${dateFilter}
  `;
  const totalResult = await db.get(totalQuery, queryParams);

  // Get category breakdown
  const categoryQuery = `
    SELECT 
      category,
      COUNT(*) as count,
      SUM(amount) as total
    FROM expenses 
    WHERE user_id = ? ${dateFilter}
    GROUP BY category
    ORDER BY total DESC
  `;
  const categoryResults = await db.all(categoryQuery, queryParams);

  // Get top stores
  const storeQuery = `
    SELECT 
      store_name,
      COUNT(*) as count,
      SUM(amount) as total
    FROM expenses 
    WHERE user_id = ? ${dateFilter}
    GROUP BY store_name
    ORDER BY total DESC
    LIMIT 5
  `;
  const storeResults = await db.all(storeQuery, queryParams);

  // Get recent expenses
  const recentQuery = `
    SELECT id, store_name, category, amount, purchase_date, description
    FROM expenses 
    WHERE user_id = ? ${dateFilter}
    ORDER BY purchase_date DESC, created_at DESC
    LIMIT 5
  `;
  const recentExpenses = await db.all(recentQuery, queryParams);

  res.json({
    success: true,
    data: {
      summary: {
        totalCount: totalResult.total_count,
        totalAmount: parseFloat(totalResult.total_amount),
        averageAmount: parseFloat(totalResult.average_amount)
      },
      categories: categoryResults.map(cat => ({
        ...cat,
        total: parseFloat(cat.total),
        percentage: totalResult.total_amount > 0 ? (cat.total / totalResult.total_amount * 100).toFixed(1) : '0'
      })),
      topStores: storeResults.map(store => ({
        ...store,
        total: parseFloat(store.total)
      })),
      recentExpenses: recentExpenses.map(expense => ({
        ...expense,
        amount: parseFloat(expense.amount)
      }))
    }
  });
}));

// @desc    Get spending trends
// @route   GET /api/analytics/trends
// @access  Private
router.get('/trends', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      errors: formatValidationErrors(errors.array())
    });
  }

  const db = getDatabase();
  const userId = req.user.id;
  const period = req.query.period as string || 'daily';
  const days = parseInt(req.query.days as string) || 30;

  let groupByClause: string;
  let dateFormat: string;
  
  switch (period) {
    case 'weekly':
      groupByClause = "strftime('%Y-%W', purchase_date)";
      dateFormat = "strftime('%Y-%W', purchase_date) as period";
      break;
    case 'monthly':
      groupByClause = "strftime('%Y-%m', purchase_date)";
      dateFormat = "strftime('%Y-%m', purchase_date) as period";
      break;
    default: // daily
      groupByClause = "strftime('%Y-%m-%d', purchase_date)";
      dateFormat = "strftime('%Y-%m-%d', purchase_date) as period";
  }

  const trendsQuery = `
    SELECT 
      ${dateFormat},
      COUNT(*) as count,
      SUM(amount) as total,
      AVG(amount) as average
    FROM expenses 
    WHERE user_id = ? 
      AND purchase_date >= date('now', '-${days} days')
    GROUP BY ${groupByClause}
    ORDER BY period ASC
  `;
  
  const trends = await db.all(trendsQuery, [userId]);

  res.json({
    success: true,
    data: trends.map(trend => ({
      ...trend,
      total: parseFloat(trend.total),
      average: parseFloat(trend.average)
    }))
  });
}));

// @desc    Get category analysis
// @route   GET /api/analytics/categories
// @access  Private
router.get('/categories', [
  query('start_date').optional().isISO8601().withMessage('Start date must be valid'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid')
], asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      errors: formatValidationErrors(errors.array())
    });
  }

  const db = getDatabase();
  const userId = req.user.id;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;

  // Build date filter
  let dateFilter = '';
  const queryParams: any[] = [userId];

  if (startDate && endDate) {
    dateFilter = 'AND e.purchase_date BETWEEN ? AND ?';
    queryParams.push(startDate, endDate);
  }

  const categoryQuery = `
    SELECT 
      e.category,
      c.color,
      c.icon,
      COUNT(*) as transaction_count,
      SUM(e.amount) as total_amount,
      AVG(e.amount) as average_amount,
      MIN(e.amount) as min_amount,
      MAX(e.amount) as max_amount
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name
    WHERE e.user_id = ? ${dateFilter}
    GROUP BY e.category, c.color, c.icon
    ORDER BY total_amount DESC
  `;
  
  const categories = await db.all(categoryQuery, queryParams);

  // Calculate total for percentages
  const totalAmount = categories.reduce((sum, cat) => sum + parseFloat(cat.total_amount), 0);

  res.json({
    success: true,
    data: categories.map(category => ({
      ...category,
      total_amount: parseFloat(category.total_amount),
      average_amount: parseFloat(category.average_amount),
      min_amount: parseFloat(category.min_amount),
      max_amount: parseFloat(category.max_amount),
      percentage: totalAmount > 0 ? ((parseFloat(category.total_amount) / totalAmount) * 100).toFixed(1) : '0',
      color: category.color || '#6B7280',
      icon: category.icon || '📦'
    }))
  });
}));

export default router;