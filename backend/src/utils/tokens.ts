import jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";
import { env } from "../config/env";

export function signToken(user: { id: string; email: string; role: { name: RoleName } }) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role.name }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}
