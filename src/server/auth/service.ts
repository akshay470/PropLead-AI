import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "./passwords";
import { RegisterInput, CreateStaffUserInput, LoginInput } from "./schemas";
import { SessionUser } from "./session";

// Pre-computed constant-time dummy hash to resist timing-based email enumeration
const DUMMY_BCRYPT_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export const authService = {
  /**
   * Registers a new public user account with hashed password.
   * SECURITY ENFORCEMENT: Public registration strictly creates 'buyer' accounts with isAdmin=false.
   */
  async register(input: RegisterInput): Promise<SessionUser> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "buyer",
        isAdmin: false,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isAdmin: users.isAdmin,
      });

    return {
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isAdmin: newUser.isAdmin,
    };
  },

  /**
   * Creates staff accounts (executive or admin).
   * Restricted to admin-authenticated actions only.
   */
  async createStaffUser(input: CreateStaffUserInput): Promise<SessionUser> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthError("An account with this email already exists", 409);
    }

    const passwordHash = await hashPassword(input.password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        isAdmin: input.isAdmin || input.role === "admin",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isAdmin: users.isAdmin,
      });

    return {
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isAdmin: newUser.isAdmin,
    };
  },

  /**
   * Authenticates user with email and password.
   * Constant-time comparison ensures response latency does not reveal email existence.
   */
  async login(input: LoginInput): Promise<SessionUser> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user) {
      // Execute dummy bcrypt check to prevent timing analysis
      await verifyPassword(input.password, DUMMY_BCRYPT_HASH);
      throw new AuthError("Invalid email or password", 401);
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AuthError("Invalid email or password", 401);
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    };
  },

  /**
   * Retrieves user profile by ID without sensitive fields.
   */
  async getUserById(id: string): Promise<SessionUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) return null;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    };
  },
};
