import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, formatValidationErrors, HttpStatus } from '../middleware/errorHandler';
import { getDatabase } from '../services/database';

const router = express.Router();

// Validation rules
const expenseValidation = [
  body('store_name').trim().isLength({ min: 1, max: 100 }).withMessage('Store name is required and must be less than 100 characters'),
  body('category').trim().isLength({ min: 1, max: 50 }).withMessage('Category is required and must be less than 50 characters'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('purchase_date').isISO8601().withMessage('Purchase date must be a valid date'),
  body('receipt_url').optional().isURL().withMessage('Receipt URL must be a valid URL'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

// @desc    Get all expenses for user
// @route   GET /api/expenses
// @access  Private
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().trim().isLength({ min: 1 }).withMessage('Category filter cannot be empty'),
  query('store_name').optional().trim().isLength({ min: 1 }).withMessage('Store name filter cannot be empty'),
  query('start_date').optional().isISO8601().withMessage('Start date must be valid'),
  query('end_date').optional().isISO8601().withMessage('End date must be valid'),
  query('min_amount').optional().isFloat({ min: 0 }).withMessage('Min amount must be positive'),
  query('max_amount').optional().isFloat({ min: 0 }).withMessage('Max amount must be positive'),
  query('sort_by').optional().isIn(['purchase_date', 'amount', 'store_name', 'category', 'created_at']).withMessage('Invalid sort field'),
  query('sort_order').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
  
  // Query parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  const category = req.query.category as string;
  const storeName = req.query.store_name as string;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  const minAmount = req.query.min_amount ? parseFloat(req.query.min_amount as string) : null;
  const maxAmount = req.query.max_amount ? parseFloat(req.query.max_amount as string) : null;
  const sortBy = req.query.sort_by as string || 'purchase_date';
  const sortOrder = req.query.sort_order as string || 'desc';

  // Build WHERE clause
  let whereClause = 'WHERE user_id = ?';
  const queryParams: any[] = [userId];

  if (category) {
    whereClause += ' AND category = ?';
    queryParams.push(category);
  }

  if (storeName) {
    whereClause += ' AND store_name LIKE ?';
    queryParams.push(`%${storeName}%`);
  }

  if (startDate) {
    whereClause += ' AND purchase_date >= ?';
    queryParams.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND purchase_date <= ?';
    queryParams.push(endDate);
  }

  if (minAmount !== null) {
    whereClause += ' AND amount >= ?';
    queryParams.push(minAmount);
  }

  if (maxAmount !== null) {
    whereClause += ' AND amount <= ?';
    queryParams.push(maxAmount);
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM expenses ${whereClause}`;
  const countResult = await db.get(countQuery, queryParams);
  const total = countResult.total;

  // Get expenses
  const expensesQuery = `
    SELECT id, store_name, category, amount, description, purchase_date, receipt_url, tags, created_at, updated_at
    FROM expenses 
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
    LIMIT ? OFFSET ?
  `;
  
  const expenses = await db.all(expensesQuery, [...queryParams, limit, offset]);

  // Parse tags JSON
  const parsedExpenses = expenses.map(expense => ({
    ...expense,
    tags: expense.tags ? JSON.parse(expense.tags) : []
  }));

  res.json({
    success: true,
    data: {
      expenses: parsedExpenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    }
  });
}));

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid expense ID')
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
  const expenseId = parseInt(req.params.id);

  const expense = await db.get(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    [expenseId, userId]
  );

  if (!expense) {
    return res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: 'Expense not found'
    });
  }

  // Parse tags JSON
  expense.tags = expense.tags ? JSON.parse(expense.tags) : [];

  res.json({
    success: true,
    data: expense
  });
}));

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
router.post('/', expenseValidation, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      errors: formatValidationErrors(errors.array())
    });
  }

  const db = getDatabase();
  const userId = req.user.id;
  const { store_name, category, amount, description, purchase_date, receipt_url, tags } = req.body;

  const result = await db.run(`
    INSERT INTO expenses (user_id, store_name, category, amount, description, purchase_date, receipt_url, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    store_name,
    category,
    amount,
    description || null,
    purchase_date,
    receipt_url || null,
    tags ? JSON.stringify(tags) : null
  ]);

  // Get the created expense
  const expense = await db.get('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
  expense.tags = expense.tags ? JSON.parse(expense.tags) : [];

  res.status(HttpStatus.CREATED).json({
    success: true,
    data: expense,
    message: 'Expense created successfully'
  });
}));

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid expense ID'),
  ...expenseValidation
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
  const expenseId = parseInt(req.params.id);
  const { store_name, category, amount, description, purchase_date, receipt_url, tags } = req.body;

  // Check if expense exists and belongs to user
  const existingExpense = await db.get(
    'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
    [expenseId, userId]
  );

  if (!existingExpense) {
    return res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: 'Expense not found'
    });
  }

  // Update expense
  await db.run(`
    UPDATE expenses 
    SET store_name = ?, category = ?, amount = ?, description = ?, 
        purchase_date = ?, receipt_url = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `, [
    store_name,
    category,
    amount,
    description || null,
    purchase_date,
    receipt_url || null,
    tags ? JSON.stringify(tags) : null,
    expenseId,
    userId
  ]);

  // Get updated expense
  const expense = await db.get('SELECT * FROM expenses WHERE id = ?', [expenseId]);
  expense.tags = expense.tags ? JSON.parse(expense.tags) : [];

  res.json({
    success: true,
    data: expense,
    message: 'Expense updated successfully'
  });
}));

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('Invalid expense ID')
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
  const expenseId = parseInt(req.params.id);

  // Check if expense exists and belongs to user
  const expense = await db.get(
    'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
    [expenseId, userId]
  );

  if (!expense) {
    return res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: 'Expense not found'
    });
  }

  // Delete expense
  await db.run('DELETE FROM expenses WHERE id = ? AND user_id = ?', [expenseId, userId]);

  res.json({
    success: true,
    message: 'Expense deleted successfully'
  });
}));

// @desc    Get expense categories
// @route   GET /api/expenses/categories/list
// @access  Private
router.get('/categories/list', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const db = getDatabase();
  
  // Get predefined categories
  const categories = await db.all('SELECT name, color, icon FROM categories ORDER BY name');
  
  // Get user's custom categories
  const userId = req.user.id;
  const userCategories = await db.all(`
    SELECT DISTINCT category as name, '#6B7280' as color, '📦' as icon
    FROM expenses 
    WHERE user_id = ? AND category NOT IN (SELECT name FROM categories)
    ORDER BY category
  `, [userId]);

  const allCategories = [...categories, ...userCategories];

  res.json({
    success: true,
    data: allCategories
  });
}));

export default router;