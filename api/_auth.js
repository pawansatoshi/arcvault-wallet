import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'arcvault-cc843';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function requireAuth(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) {
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const token = header.slice(7).trim();
  if (!token) {
    const error = new Error('Authentication token missing.');
    error.statusCode = 401;
    throw error;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
    });

    if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Firebase subject.');
    if (payload.auth_time && Number(payload.auth_time) > Math.floor(Date.now() / 1000)) {
      throw new Error('Invalid authentication time.');
    }

    return { uid: payload.sub, claims: payload };
  } catch {
    const error = new Error('Invalid or expired authentication token.');
    error.statusCode = 401;
    throw error;
  }
}

export async function requireOwnedWallet(req, walletId) {
  const auth = await requireAuth(req);
  if (!walletId || !/^[0-9a-f-]{20,80}$/i.test(String(walletId))) {
    const error = new Error('Invalid wallet identifier.');
    error.statusCode = 400;
    throw error;
  }

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    const error = new Error('Circle API is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`https://api.circle.com/v1/w3s/wallets/${encodeURIComponent(walletId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.data?.wallet) {
    const error = new Error('Wallet could not be verified.');
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }

  const wallet = result.data.wallet;
  if (wallet.refId !== auth.uid && wallet.userId !== auth.uid) {
    const error = new Error('Wallet is not owned by the authenticated user.');
    error.statusCode = 403;
    throw error;
  }

  return { ...auth, wallet };
}

export function authError(res, error) {
  const status = Number(error?.statusCode) || 500;
  return res.status(status).json({
    error: status >= 500 ? 'Authentication or authorization service error.' : error.message,
  });
}
