import type { NextFunction, Request, Response } from "express";

// TEMPORARY: there is no real login yet.
// The frontend sends a header "x-user-id: demo-user" and we trust it.
//
// LATER (real login): the frontend sends "Authorization: Bearer <supabase token>",
// and this middleware verifies the token with Supabase and sets req.userId
// to the real user's id. The routes won't need to change at all.
export function demoUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");

  if (!userId) {
    res.status(401).json({ error: "Missing x-user-id header" });
    return;
  }

  req.userId = userId;
  next();
}
