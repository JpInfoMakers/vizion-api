import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

/**
 * Gera um UUID (v4).
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Gera o hash de uma senha em texto plano.
 * @param plain senha em texto plano
 * @returns hash seguro (bcrypt)
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/**
 * Compara uma senha em texto plano com um hash.
 * @param plain senha fornecida
 * @param hash hash armazenado
 * @returns true se bater, false caso contrário
 */
export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Remove campos sensíveis de um objeto usuário antes de devolver na resposta.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, 'passwordHash' | 'refreshTokenHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, refreshTokenHash, ...safe } = user;
  return safe;
}
