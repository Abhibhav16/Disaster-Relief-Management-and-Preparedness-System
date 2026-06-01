import { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (!unsafeMethods.has(req.method)) return next();
  if (req.path === "/api/auth/login" || req.path === "/api/auth/register") return next();
  if (req.headers["x-requested-with"] === "XMLHttpRequest") return next();
  return res.status(403).json({ message: "CSRF protection header missing" });
}

