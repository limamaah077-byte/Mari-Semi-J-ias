import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';

export const ADMIN_PHONE_NORMALIZED = '11999450305';
export const ADMIN_PHONE_DISPLAY = '(11) 99945-0305';

const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export interface SessionPayload {
  sub: string;
  phone: string;
  name: string;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const full: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12h
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SIGNING_KEY)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAdminAuthStatus(): {
  needs_setup: boolean;
  env_override: boolean;
  admin_phone_display: string;
} {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    return {
      needs_setup: false,
      env_override: true,
      admin_phone_display: ADMIN_PHONE_DISPLAY,
    };
  }
  const existing = db
    .prepare('SELECT id FROM admin_users WHERE phone_normalized = ?')
    .get(ADMIN_PHONE_NORMALIZED) as { id: number } | undefined;
  return {
    needs_setup: !existing,
    env_override: false,
    admin_phone_display: ADMIN_PHONE_DISPLAY,
  };
}

export function setupInitialAdmin(phone: string, password: string, name?: string): {
  ok: boolean;
  error?: string;
  token?: string;
  admin?: { name: string; phone: string };
} {
  if (process.env.ADMIN_PASSCODE?.trim()) {
    return { ok: false, error: 'A senha administrativa já está definida via variável de ambiente.' };
  }
  const norm = normalizePhone(phone);
  if (norm !== ADMIN_PHONE_NORMALIZED) {
    return {
      ok: false,
      error: `Utilize o telefone autorizado da loja (${ADMIN_PHONE_DISPLAY}).`,
    };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'A senha deve possuir pelo menos 6 caracteres.' };
  }

  const displayName = (name || 'Mariê Administradora').trim().slice(0, 80);
  const { hash, salt } = hashPassword(password);

  const tx = db.transaction(() => {
    const exists = db
      .prepare('SELECT id FROM admin_users WHERE phone_normalized = ?')
      .get(ADMIN_PHONE_NORMALIZED);
    if (exists) {
      return false;
    }
    db.prepare(
      'INSERT INTO admin_users (phone_normalized, display_phone, name, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)'
    ).run(ADMIN_PHONE_NORMALIZED, ADMIN_PHONE_DISPLAY, displayName, hash, salt);
    return true;
  });

  const inserted = tx();
  if (!inserted) {
    return { ok: false, error: 'Conta administrativa já configurada. Faça login.' };
  }

  const token = createSessionToken({
    sub: 'admin',
    phone: ADMIN_PHONE_DISPLAY,
    name: displayName,
  });
  return { ok: true, token, admin: { name: displayName, phone: ADMIN_PHONE_DISPLAY } };
}

export function loginAdmin(
  clientIp: string,
  phone: string,
  password: string
): {
  ok: boolean;
  error?: string;
  token?: string;
  admin?: { name: string; phone: string };
} {
  const now = Date.now();
  const attempt = loginAttempts.get(clientIp);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) {
    return {
      ok: false,
      error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    };
  }

  const norm = normalizePhone(phone);
  if (norm !== ADMIN_PHONE_NORMALIZED) {
    recordFailure(clientIp);
    return { ok: false, error: 'Telefone ou senha inválidos.' };
  }

  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    const passBuf = Buffer.from(password || '');
    const envBuf = Buffer.from(envPass);
    const valid = passBuf.length === envBuf.length && crypto.timingSafeEqual(passBuf, envBuf);
    if (!valid) {
      recordFailure(clientIp);
      return { ok: false, error: 'Telefone ou senha inválidos.' };
    }
    loginAttempts.delete(clientIp);
    const token = createSessionToken({
      sub: 'admin',
      phone: ADMIN_PHONE_DISPLAY,
      name: 'Mariê Administradora',
    });
    return { ok: true, token, admin: { name: 'Mariê Administradora', phone: ADMIN_PHONE_DISPLAY } };
  }

  const user = db
    .prepare('SELECT id, name, password_hash, password_salt FROM admin_users WHERE phone_normalized = ?')
    .get(ADMIN_PHONE_NORMALIZED) as
    | { id: number; name: string; password_hash: string; password_salt: string }
    | undefined;

  if (!user || !verifyPassword(password || '', user.password_hash, user.password_salt)) {
    recordFailure(clientIp);
    return { ok: false, error: 'Telefone ou senha inválidos.' };
  }

  loginAttempts.delete(clientIp);
  const token = createSessionToken({
    sub: String(user.id),
    phone: ADMIN_PHONE_DISPLAY,
    name: user.name,
  });
  return { ok: true, token, admin: { name: user.name, phone: ADMIN_PHONE_DISPLAY } };
}

export function changeAdminPassword(currentPassword: string, newPassword: string): {
  ok: boolean;
  error?: string;
} {
  if (process.env.ADMIN_PASSCODE?.trim()) {
    return {
      ok: false,
      error: 'A senha é gerenciada pela variável de ambiente ADMIN_PASSCODE.',
    };
  }
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'A nova senha deve possuir no mínimo 6 caracteres.' };
  }
  const user = db
    .prepare('SELECT id, password_hash, password_salt FROM admin_users WHERE phone_normalized = ?')
    .get(ADMIN_PHONE_NORMALIZED) as
    | { id: number; password_hash: string; password_salt: string }
    | undefined;
  if (!user || !verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
    return { ok: false, error: 'Senha atual incorreta.' };
  }
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(
    "UPDATE admin_users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, salt, user.id);
  return { ok: true };
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const prev = loginAttempts.get(ip);
  if (!prev || prev.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    prev.count += 1;
  }
}

export interface AdminRequest extends Request {
  adminUser?: SessionPayload;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acesso administrativo não autorizado.' });
    return;
  }
  const token = auth.slice(7).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão expirada ou inválida.' });
    return;
  }
  req.adminUser = payload;
  next();
}
