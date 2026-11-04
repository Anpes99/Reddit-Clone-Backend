// Properties the middleware in utils/middleware/middleware.ts adds to requests
declare global {
  namespace Express {
    interface Request {
      // Set by tokenExtractor
      token?: string;
      // Set by userExtractor from a valid JWT; requireAuth rejects requests without it
      user?: { id: number; username: string };
    }
  }
}

export {};
