import { verifyAccessToken } from '../../../src/auth/tokens.js';

function parseBearerAuth(req) {
  const header = req?.headers?.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  try {
    const decoded = verifyAccessToken(token);
    return {
      userId: decoded.sub,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function createContext({ req, res }) {
  return {
    req,
    res,
    auth: parseBearerAuth(req),
  };
}
