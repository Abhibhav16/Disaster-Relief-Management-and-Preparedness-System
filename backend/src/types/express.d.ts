import { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      role: RoleName;
      email: string;
    }
    interface Request {
      user?: User;
    }
  }
}

