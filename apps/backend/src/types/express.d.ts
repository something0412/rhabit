// Tells TypeScript that every request has `req.userId` (set by the demoUser middleware).
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export {};
