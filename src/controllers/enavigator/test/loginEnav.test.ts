import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const supabaseSingleMock = vi.hoisted(() => vi.fn());
const supabaseEqMock = vi.hoisted(() => vi.fn(() => ({ single: supabaseSingleMock })));
const supabaseSelectMock = vi.hoisted(() => vi.fn(() => ({ eq: supabaseEqMock })));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(() => ({ select: supabaseSelectMock })),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
    },
  })),
}));

import { login, me } from '../loginEnav';

const mockedJwtSign = vi.mocked(jwt.sign);
const mockedJwtVerify = vi.mocked(jwt.verify);

describe('eNavigator auth controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('returns 400 when contact or password is missing', async () => {
    req.body = { contact: 'admin@example.com' };

    await login(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Contact and password are required' });
  });

  it('returns 401 when login credentials are invalid', async () => {
    req.body = { contact: 'admin@example.com', password: 'secret' };
    signInWithPasswordMock.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });

    await login(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('returns 404 when the eNavigator profile is missing', async () => {
    req.body = { contact: 'admin@example.com', password: 'secret' };
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: 'enav-1' } }, error: null });
    supabaseSingleMock.mockResolvedValue({ data: null, error: { message: 'missing' } });

    await login(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'eNavigator profile not found' });
  });

  it('returns a token and user payload for a valid login', async () => {
    req.body = { contact: 'admin@example.com', password: 'secret' };
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: 'enav-1' } }, error: null });
    supabaseSingleMock.mockResolvedValue({
      data: { enav_id: 'enav-1', contact: 'admin@example.com', name: 'Admin' },
      error: null,
    });
    mockedJwtSign.mockReturnValue('signed-token' as never);

    await login(req as Request, res as Response);

    expect(mockedJwtSign).toHaveBeenCalledWith(
      { userId: 'enav-1', role: 'admin', contact: 'admin@example.com' },
      expect.any(String),
      { expiresIn: '3d' },
    );
    expect(res.json).toHaveBeenCalledWith({
      token: 'signed-token',
      user: {
        enav_id: 'enav-1',
        email: 'admin@example.com',
      },
    });
  });

  it('returns 401 when me has no bearer token', async () => {
    req.headers = {};

    await me(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  it('returns the decoded user from a valid token', async () => {
    req.headers = { authorization: 'Bearer token-123' };
    mockedJwtVerify.mockReturnValue({
      userId: 'enav-1',
      role: 'admin',
      contact: 'admin@example.com',
    } as never);

    await me(req as Request, res as Response);

    expect(mockedJwtVerify).toHaveBeenCalledWith('token-123', expect.any(String));
    expect(res.json).toHaveBeenCalledWith({
      user: {
        userId: 'enav-1',
        role: 'admin',
        contact: 'admin@example.com',
      },
    });
  });
});