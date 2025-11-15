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
    saveUninitialized: true, // Changed to true to ensure session is created during OAuth flow
    cookie: {
      httpOnly: true,
      secure: false, // Disabled for development to ensure cookies work across redirects
      sameSite: 'lax', // Allow cookies to be sent on redirects from external auth provider
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
      const claims = tokens.claims();
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(claims);
      verified(null, user);
    } catch (error) {
      console.error("Authentication verify error:", error);
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
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    console.log("[LOGIN] hostname:", req.hostname, "host header:", req.get('host'), "resolved hostname:", hostname);
    ensureStrategy(hostname);
    passport.authenticate(`replitauth:${hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    try {
      const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
      console.log("[CALLBACK START] hostname:", req.hostname, "host header:", req.get('host'), "resolved hostname:", hostname);
      console.log("[CALLBACK START] query:", JSON.stringify(req.query));
      console.log("[CALLBACK START] headers x-forwarded-host:", req.get('x-forwarded-host'), "x-forwarded-proto:", req.get('x-forwarded-proto'));
      console.log("[CALLBACK START] session exists:", !!req.session, "session ID:", req.session?.id);
      
      ensureStrategy(hostname);
      console.log("[CALLBACK] Strategy ensured for:", hostname);
      
      passport.authenticate(`replitauth:${hostname}`, (err: any, user: any, info: any) => {
        console.log("[CALLBACK AUTH] Authenticate callback invoked - err:", !!err, "user:", !!user, "info:", JSON.stringify(info));
        
        if (err) {
          console.error("[CALLBACK ERROR] Authentication error:", err);
          console.error("[CALLBACK ERROR] Error stack:", err.stack);
          return res.status(500).json({ 
            message: "Authentication failed", 
            error: err.message || "Unknown error",
            details: process.env.NODE_ENV === "development" ? err.stack : undefined
          });
        }
        if (!user) {
          console.error("[CALLBACK ERROR] No user returned, info:", info);
          return res.redirect("/api/login");
        }
        
        console.log("[CALLBACK] Logging in user...");
        req.logIn(user, (err) => {
          if (err) {
            console.error("[CALLBACK ERROR] Session login failed:", err);
            console.error("[CALLBACK ERROR] Login error stack:", err.stack);
            return res.status(500).json({ 
              message: "Failed to establish session", 
              error: err.message,
              details: process.env.NODE_ENV === "development" ? err.stack : undefined
            });
          }
          console.log("[CALLBACK SUCCESS] User logged in, redirecting to /");
          return res.redirect("/");
        });
      })(req, res, next);
    } catch (error) {
      console.error("[CALLBACK FATAL ERROR] Uncaught error in callback handler:", error);
      console.error("[CALLBACK FATAL ERROR] Stack:", error instanceof Error ? error.stack : "No stack");
      return res.status(500).json({ 
        message: "Internal server error", 
        error: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined
      });
    }
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
