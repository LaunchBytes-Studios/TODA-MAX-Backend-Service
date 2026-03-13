import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// Define a custom type for the decoded JWT payload
interface JwtPayload {
  userId: string;
  role: string;
  contact: string;
}

// Extend Express Request to include `user`
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const authenticatePatient = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded; // ✅ only set the user
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', details: err });
  }
};
