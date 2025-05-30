import express from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, formatValidationErrors, HttpStatus } from '../middleware/errorHandler';
import { getDatabase } from '../services/database';

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
router.get('/profile', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const db = getDatabase();
  const userId = req.user.id;

  // Get user with preferences
  const userQuery = `
    SELECT 
      u.id, u.email, u.name, u.picture, u.created_at, u.updated_at,
      p.currency, p.timezone, p.notification_email, 
      p.notification_weekly_summary, p.notification_budget_alerts
    FROM users u
    LEFT JOIN user_preferences p ON u.id = p.user_id
    WHERE u.id = ?
  `;
  
  const user = await db.get(userQuery, [userId]);

  if (!user) {
    return res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      preferences: {
        currency: user.currency || 'USD',
        timezone: user.timezone || 'UTC',
        notifications: {
          email: user.notification_email !== 0,
          weeklySummary: user.notification_weekly_summary !== 0,
          budgetAlerts: user.notification_budget_alerts !== 0
        }
      }
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('timezone').optional().trim().isLength({ min: 1 }).withMessage('Timezone is required'),
  body('notifications.email').optional().isBoolean().withMessage('Email notification must be boolean'),
  body('notifications.weeklySummary').optional().isBoolean().withMessage('Weekly summary notification must be boolean'),
  body('notifications.budgetAlerts').optional().isBoolean().withMessage('Budget alerts notification must be boolean')
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
  const { name, currency, timezone, notifications } = req.body;

  // Update user info if provided
  if (name) {
    await db.run(
      'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, userId]
    );
  }

  // Update preferences if provided
  if (currency || timezone || notifications) {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (currency) {
      updateFields.push('currency = ?');
      updateValues.push(currency);
    }

    if (timezone) {
      updateFields.push('timezone = ?');
      updateValues.push(timezone);
    }

    if (notifications) {
      if (typeof notifications.email === 'boolean') {
        updateFields.push('notification_email = ?');
        updateValues.push(notifications.email ? 1 : 0);
      }
      if (typeof notifications.weeklySummary === 'boolean') {
        updateFields.push('notification_weekly_summary = ?');
        updateValues.push(notifications.weeklySummary ? 1 : 0);
      }
      if (typeof notifications.budgetAlerts === 'boolean') {
        updateFields.push('notification_budget_alerts = ?');
        updateValues.push(notifications.budgetAlerts ? 1 : 0);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(userId);

      const updateQuery = `
        UPDATE user_preferences 
        SET ${updateFields.join(', ')}
        WHERE user_id = ?
      `;
      
      await db.run(updateQuery, updateValues);
    }
  }

  // Get updated user profile
  const userQuery = `
    SELECT 
      u.id, u.email, u.name, u.picture, u.created_at, u.updated_at,
      p.currency, p.timezone, p.notification_email, 
      p.notification_weekly_summary, p.notification_budget_alerts
    FROM users u
    LEFT JOIN user_preferences p ON u.id = p.user_id
    WHERE u.id = ?
  `;
  
  const user = await db.get(userQuery, [userId]);

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      preferences: {
        currency: user.currency || 'USD',
        timezone: user.timezone || 'UTC',
        notifications: {
          email: user.notification_email !== 0,
          weeklySummary: user.notification_weekly_summary !== 0,
          budgetAlerts: user.notification_budget_alerts !== 0
        }
      }
    },
    message: 'Profile updated successfully'
  });
}));

// @desc    Get user statistics
// @route   GET /api/user/stats
// @access  Private
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const db = getDatabase();
  const userId = req.user.id;

  // Get user statistics
  const statsQuery = `
    SELECT 
      COUNT(*) as total_expenses,
      COALESCE(SUM(amount), 0) as total_spent,
      COALESCE(AVG(amount), 0) as average_expense,
      COUNT(DISTINCT category) as categories_used,
      COUNT(DISTINCT store_name) as stores_visited,
      MIN(purchase_date) as first_expense_date,
      MAX(purchase_date) as last_expense_date
    FROM expenses 
    WHERE user_id = ?
  `;
  
  const stats = await db.get(statsQuery, [userId]);

  // Get this month's statistics
  const thisMonthQuery = `
    SELECT 
      COUNT(*) as this_month_expenses,
      COALESCE(SUM(amount), 0) as this_month_spent
    FROM expenses 
    WHERE user_id = ? 
      AND strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now')
  `;
  
  const thisMonth = await db.get(thisMonthQuery, [userId]);

  res.json({
    success: true,
    data: {
      totalExpenses: stats.total_expenses,
      totalSpent: parseFloat(stats.total_spent),
      averageExpense: parseFloat(stats.average_expense),
      categoriesUsed: stats.categories_used,
      storesVisited: stats.stores_visited,
      firstExpenseDate: stats.first_expense_date,
      lastExpenseDate: stats.last_expense_date,
      thisMonth: {
        expenses: thisMonth.this_month_expenses,
        spent: parseFloat(thisMonth.this_month_spent)
      }
    }
  });
}));

export default router;