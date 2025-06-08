import { SHA256 } from 'crypto-js';
import DOMPurify from 'dompurify';
import { z } from 'zod';
import { UserRole } from '@/lib/types';
import bcrypt from 'bcryptjs';

// Session token interface
export interface SessionToken {
  token: string;
  csrfToken: string;
  expiresAt: number;
  userId: string;
  lastRotated: number;
}

// Input validation schemas
export const userSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/^[A-Za-z0-9]+$/, "Password can only contain letters and numbers"),
  name: z.string().min(2),
  role: z.enum(['district_engineer', 'regional_engineer', 'global_engineer', 'system_admin', 'technician']),
  region: z.string().optional(),
  district: z.string().optional()
});

// Password validation schema
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Password hashing with bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12); // Generate salt with 12 rounds
  return bcrypt.hash(password, salt);
};

// Password verification
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// CSRF token generation
export const generateCSRFToken = (): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Session token generation
export const generateSessionToken = (userId: string): SessionToken => {
  return {
    token: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    csrfToken: generateCSRFToken(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    userId,
    lastRotated: Date.now()
  };
};

// Session validation
export const validateSessionToken = (token: SessionToken): boolean => {
  return token.expiresAt > Date.now();
};

// Session storage in httpOnly cookies
export const storeSession = (session: SessionToken): void => {
  const secure = window.location.protocol === 'https:';
  document.cookie = `session=${JSON.stringify(session)}; path=/; httpOnly; ${secure ? 'secure;' : ''} sameSite=strict`;
};

// XSS protection
export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Only allow text
    ALLOWED_ATTR: []
  });
};

// Role hierarchy for access control
const roleHierarchy: { [key in Exclude<UserRole, null>]: number } = {
  system_admin: 4,
  admin: 3,
  regional_manager: 2,
  regional_general_manager: 2,
  district_engineer: 1,
  district_manager: 1,
  viewer: 0
};

// Role-based access validation
export const hasRequiredRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  if (!userRole || !requiredRole) return false;
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Input validation
export const validateUserInput = (input: unknown) => {
  return userSchema.parse(input);
}; 