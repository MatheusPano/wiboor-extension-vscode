/**
 * Decodificação de JWT (sem verificação de assinatura).
 *
 * A API key da Wiboor é um JWT que carrega o id do usuário no payload:
 *   { "userId": "...", "companyId": "...", "email": "...", "iat": ..., "exp": ... }
 *
 * Aqui apenas lemos esse payload para extrair o userId — não validamos a
 * assinatura, pois quem valida é o backend ao receber o Bearer token.
 */

export type JwtPayload = {
  userId?: string;
  companyId?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
};

/** Decodifica o payload (segunda parte) de um JWT. Retorna undefined se inválido. */
export function decodeJwt(token: string): JwtPayload | undefined {
  const parts = token.trim().split(".");
  if (parts.length < 2 || !parts[1]) {
    return undefined;
  }

  try {
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function extractUserId(token: string): string | undefined {
  const userId = decodeJwt(token)?.userId;
  return typeof userId === "string" && userId.trim() ? userId.trim() : undefined;
}

/** Indica se o JWT já passou da data de expiração (exp em segundos). */
export function isExpired(token: string, nowMs = Date.now()): boolean {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === "number" && exp * 1000 < nowMs;
}
