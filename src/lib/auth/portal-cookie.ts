/**
 * Portal auth cookie name.
 *
 * Kept in a standalone, dependency-free module so it can be imported from both
 * the Edge-runtime middleware (src/proxy.ts) and the Node-only portal auth
 * helpers (src/lib/auth/account-auth.ts), which pull in node:crypto/bcrypt and
 * therefore cannot be loaded in the Edge runtime.
 */
export const PORTAL_COOKIE_NAME = "portal-auth-token";
