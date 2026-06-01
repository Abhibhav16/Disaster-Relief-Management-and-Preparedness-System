import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: err.flatten() });
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const status = message.includes("not found") ? 404 : 500;
  return res.status(status).json({ message });
}

