import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string;
  botDisplayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'No autorizado. Se requiere iniciar sesión.' });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    
    const userRes = await query(
      'SELECT id, email, name, picture_url, bot_display_name FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
      return;
    }

    const row = userRes.rows[0];
    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      botDisplayName: row.bot_display_name,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Sesión expirada. Por favor ingresa nuevamente.' });
      return;
    }
    res.status(401).json({ error: 'Token inválido.' });
  }
}
