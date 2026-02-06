import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

interface UserPayload extends JwtPayload {
  userId: string;
  role: string;
  contact: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (typeof decoded === 'string') {
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    const payload = decoded as JwtPayload;
    const { userId, role, contact } = payload;
    
    if (!userId || !role || !contact) {
      return res.status(401).json({ error: 'Token missing required fields' });
    }

    req.user = {
      userId,
      role,
      contact,
      iat: payload.iat,
      exp: payload.exp,
      ...payload
    };
    
    next();
    
  } catch (err) {
    console.error('Authentication error:', err);
    
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(401).json({ error: 'Authentication failed' });
  }
};