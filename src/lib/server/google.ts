import "server-only";
import { createHash } from "node:crypto";
import { randomToken } from "./crypto";
import { env } from "./env";

export const GOOGLE_STATE_COOKIE = "jc_google";
export const googleRedirectUri = () => `${env.APP_URL}/api/auth/google/callback`;

/** Builds Google's consent URL plus the state/PKCE values to keep in a short-lived cookie. */
export function googleAuthRequest(next: string) {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url, cookie: JSON.stringify({ state, verifier, next }) };
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; givenName: string; familyName: string };

/** Exchanges the authorization code and reads the profile from Google's userinfo endpoint. */
export async function googleProfile(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`);
  const info = (await infoRes.json()) as { sub: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string; name?: string };
  if (!info.email) throw new Error("Google account has no email");
  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified: info.email_verified === true,
    givenName: info.given_name ?? info.name ?? info.email.split("@")[0],
    familyName: info.family_name ?? "",
  };
}
