import "server-only";

import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

/** Six-digit password handed to a member by the administration. */
export function generatePassword(): string {
  return String(randomInt(100000, 1000000));
}
