import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      console.log("[AUTH] Starting verify function");
      const claims = tokens.claims();
      console.log("[AUTH] Got claims:", JSON.stringify(claims, null, 2));
      
      const user = {};
      updateUserSession(user, tokens);
      console.log("[AUTH] Updated user session");
      
      await upsertUser(claims);
      console.log("[AUTH] Upserted user to database");
      
      verified(null, user);
      console.log("[AUTH] Verify function completed successfully");
    } catch (error) {
      console.error("[AUTH ERROR] Error in authentication verify function:", error);
      console.error("[AUTH ERROR] Stack:", error instanceof Error ? error.stack : "No stack");
      verified(error instanceof Error ? error : new Error("Authentication failed"), undefined);
    }
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log("[AUTH] /api/login hit, hostname:", req.hostname);
    console.log("[AUTH] Session ID:", req.session?.id);
    console.log("[AUTH] Cookies:", req.headers.cookie);
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("[AUTH] /api/callback hit, hostname:", req.hostname);
    console.log("[AUTH] Session ID:", req.session?.id);
    console.log("[AUTH] Cookies:", req.headers.cookie);
    console.log("[AUTH] Query params:", req.query);
    ensureStrategy(req.hostname);
    console.log("[AUTH] Strategy ensured, authenticating...");
    
    passport.authenticate(`replitauth:${req.hostname}`, (err: any, user: any, info: any) => {
      console.log("[AUTH] Passport authenticate callback invoked");
      console.log("[AUTH] err:", err);
      console.log("[AUTH] user:", user);
      console.log("[AUTH] info:", info);
      
      if (err) {
        console.error("[AUTH ERROR] Authentication callback error:", err);
        console.error("[AUTH ERROR] Error stack:", err.stack);
        return res.status(500).json({ 
          message: "Authentication failed", 
          error: err.message || "Unknown error",
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined
        });
      }
      if (!user) {
        console.error("[AUTH ERROR] Authentication failed - no user:", info);
        return res.redirect("/api/login");
      }
      
      console.log("[AUTH] Attempting to log in user...");
      req.logIn(user, (err) => {
        if (err) {
          console.error("[AUTH ERROR] Session login error:", err);
          console.error("[AUTH ERROR] Session error stack:", err.stack);
          return res.status(500).json({ 
            message: "Failed to establish session", 
            error: err.message,
            stack: process.env.NODE_ENV === "development" ? err.stack : undefined
          });
        }
        console.log("[AUTH] Login successful, redirecting to /");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
