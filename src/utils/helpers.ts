import { Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Wraps a route handler and catches any thrown errors into a JSON response.
export const asyncHandler =
  (label: string, fn: (req: Request, res: Response) => Promise<Response>) =>
  async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (error: unknown) {
      const status = error instanceof HttpError ? error.status : 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return res.status(status).json({ success: false, message: label, error: msg });
    }
  };

export const requirePatientId = (req: Request): string => {
  const id = req.user?.userId;
  if (!id) throw new HttpError(401, 'Unauthorized: Patient ID not found');
  return id;
};

// Express params can be string | string[] depending on route config.
export const parseId = (idParam: string | string[]): string =>
  Array.isArray(idParam) ? idParam[0] : idParam;
