import { Request, Response } from 'express';
import { HttpStatus } from './errorHandler';

export const notFound = (req: Request, res: Response): void => {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      path: req.originalUrl,
      method: req.method
    },
    timestamp: new Date().toISOString()
  });
};

export default notFound;