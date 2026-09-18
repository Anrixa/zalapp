import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, createVerify } from 'node:crypto';
import { ErrorCode } from '@zal/contracts';
import { AppError } from '../../common/errors/app-error';
import { loadEnv } from '../../config/env';

interface GoogleJwk {
  kid: string;
  n: string;
  e: string;
  alg: string;
  kty: string;
}

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/**
 * Verify a Google ID token.
 *
 * Written against Google's published JWKS rather than pulled in as a dependency
 * so the trust boundary is visible: signature, issuer, audience and expiry are
 * each checked here, and a token that fails any of them is refused. Decoding
 * the payload without verifying — the mistake this class exists to avoid —
 * would let anyone sign in as anyone.
 */
@Injectable()
export class GoogleVerifierService {
  private readonly logger = new Logger(GoogleVerifierService.name);
  private readonly env = loadEnv();
  private keyCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null;

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.env.GOOGLE_CLIENT_ID) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Google sign-in is not configured on this environment',
      );
    }

    const [headerPart, payloadPart, signaturePart] = idToken.split('.');
    if (!headerPart || !payloadPart || !signaturePart) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }

    const header = decodeSegment<{ kid?: string; alg?: string }>(headerPart);
    if (header.alg !== 'RS256' || !header.kid) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }

    const key = await this.findKey(header.kid);
    const publicKey = createPublicKey({
      key: { kty: 'RSA', n: key.n, e: key.e },
      format: 'jwk',
    });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerPart}.${payloadPart}`);
    const signatureValid = verifier.verify(publicKey, Buffer.from(signaturePart, 'base64url'));

    if (!signatureValid) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }

    const payload = decodeSegment<{
      iss?: string;
      aud?: string;
      sub?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    }>(payloadPart);

    if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }
    if (payload.aud !== this.env.GOOGLE_CLIENT_ID) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'That Google sign-in was issued elsewhere');
    }
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'That Google sign-in has expired');
    }
    if (!payload.sub) {
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email?.toLowerCase() ?? null,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }

  private async findKey(kid: string): Promise<GoogleJwk> {
    const fresh = this.keyCache && Date.now() - this.keyCache.fetchedAt < 60 * 60 * 1000;
    if (!fresh) {
      const response = await fetch(GOOGLE_CERTS_URL);
      if (!response.ok) {
        throw new AppError(ErrorCode.INTERNAL, 'Could not reach Google to verify that sign-in');
      }
      const body = (await response.json()) as { keys: GoogleJwk[] };
      this.keyCache = { keys: body.keys, fetchedAt: Date.now() };
    }

    const key = this.keyCache?.keys.find((candidate) => candidate.kid === kid);
    if (!key) {
      // Google rotates keys; a miss on a cached set is worth exactly one refetch.
      this.keyCache = null;
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        'That Google sign-in could not be verified',
      );
    }
    return key;
  }
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}
