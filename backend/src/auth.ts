import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { authConfig } from './db.js';

interface JwtPayload {
  role: 'admin';
  username: string;
}

type LoginAttempt = { count: number; blockedUntil: number };
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 10 * 60 * 1000;

export function signToken(): string {
  const { USERNAME, JWT_SECRET } = authConfig();
  return jwt.sign({ role: 'admin', username: USERNAME } as JwtPayload, JWT_SECRET, {
    expiresIn: '12h',
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: token dibutuhkan' });
  }
  try {
    const decoded = jwt.verify(token, authConfig().JWT_SECRET) as JwtPayload;
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    (req as any).admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid atau kadaluarsa' });
  }
}

export function loginHandler(req: Request, res: Response) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = loginAttempts.get(key);
  const time = Date.now();
  if (current?.blockedUntil && current.blockedUntil > time) {
    const retryAfter = Math.ceil((current.blockedUntil - time) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${retryAfter} detik.` });
  }

  const { username, password } = req.body ?? {};
  const cfg = authConfig();
  if (username === cfg.USERNAME && password === cfg.PASSWORD) {
    loginAttempts.delete(key);
    return res.json({ token: signToken(), username: cfg.USERNAME });
  }

  const count = (current?.blockedUntil && current.blockedUntil <= time ? 0 : current?.count ?? 0) + 1;
  loginAttempts.set(key, {
    count,
    blockedUntil: count >= MAX_LOGIN_ATTEMPTS ? time + LOGIN_BLOCK_MS : 0,
  });
  return res.status(401).json({ error: 'Username atau password salah' });
}