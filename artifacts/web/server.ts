import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionSecret =
  process.env.ADMIN_SESSION_SECRET?.trim() || crypto.randomBytes(32).toString("hex");

type PlaceCategory =
  | "Campus"
  | "Academic"
  | "Food"
  | "Residence"
  | "Sports"
  | "Services";

type StoredCampusPlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  note: string;
  createdAt: string;
  updatedAt?: string;
};

type ClaimedAdmin = {
  username: string;
  salt: string;
  hash: string;
};

let claimedAdmin: ClaimedAdmin | null = null;
const customPlaces: StoredCampusPlace[] = [];
const placeOverrides = new Map<string, StoredCampusPlace>();

const PLACE_CATEGORIES = [
  "Campus",
  "Academic",
  "Food",
  "Residence",
  "Sports",
  "Services",
] as const;

const AdminCredentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

const AdminSetupSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(6).max(256),
});

const PlacePayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(PLACE_CATEGORIES),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  note: z.string().trim().max(160).optional(),
});

function getAdminMode(): "env" | "claimed" | "unconfigured" {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0) {
    return "env";
  }
  if (claimedAdmin !== null) {
    return "claimed";
  }
  return "unconfigured";
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function safeEqualText(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256Buffer(a), sha256Buffer(b));
}

function verifyPasswordWithSalt(
  password: string,
  salt: string,
  expectedHexHash: string,
): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHexHash, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function issueSessionToken(username: string): { token: string; expiresAt: string } {
  const expiresMs = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ sub: username, exp: expiresMs }),
    "utf8",
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

function verifySessionToken(token: string): { sub: string; exp: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sub?: unknown; exp?: unknown };
    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return { sub: parsed.sub, exp: parsed.exp };
  } catch {
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Administrator sign-in is required." });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Session expired or invalid. Sign in again." });
    return;
  }
  next();
}

function makePlaceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug || "place"}-${suffix}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/admin/status", (_req, res) => {
    const mode = getAdminMode();
    res.json({
      configured: mode !== "unconfigured",
      mode,
    });
  });

  app.post("/api/admin/setup", (req, res) => {
    if (getAdminMode() !== "unconfigured") {
      res.status(409).json({
        error: "Administrator credentials are already configured.",
      });
      return;
    }

    const parsed = AdminSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: "Enter a username and a password of at least 6 characters.",
      });
      return;
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(parsed.data.password, salt, 64).toString("hex");
    claimedAdmin = {
      username: parsed.data.username,
      salt,
      hash,
    };

    const session = issueSessionToken(claimedAdmin.username);
    res.status(201).json({
      ...session,
      username: claimedAdmin.username,
    });
  });

  app.post("/api/admin/login", (req, res) => {
    const mode = getAdminMode();
    if (mode === "unconfigured") {
      res.status(503).json({
        error: "Admin access has not been set up yet.",
      });
      return;
    }

    const parsed = AdminCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Enter both username and password." });
      return;
    }

    const { username, password } = parsed.data;
    let valid = false;

    if (mode === "env") {
      const expectedUser = process.env.ADMIN_USERNAME?.trim() || "admin";
      const expectedPass = process.env.ADMIN_PASSWORD || "";
      valid =
        safeEqualText(username, expectedUser) &&
        safeEqualText(password, expectedPass);
    } else if (claimedAdmin) {
      valid =
        safeEqualText(username, claimedAdmin.username) &&
        verifyPasswordWithSalt(password, claimedAdmin.salt, claimedAdmin.hash);
    }

    if (!valid) {
      res.status(401).json({ error: "Username or password is incorrect." });
      return;
    }

    const session = issueSessionToken(username);
    res.json({
      ...session,
      username,
    });
  });

  app.get("/api/campus-places", (_req, res) => {
    res.json({
      items: customPlaces,
      overrides: Array.from(placeOverrides.values()),
    });
  });

  app.post("/api/campus-places", requireAdmin, (req, res) => {
    const parsed = PlacePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: "Provide a valid place name, category, latitude, and longitude.",
      });
      return;
    }

    const created: StoredCampusPlace = {
      id: makePlaceId(parsed.data.name),
      name: parsed.data.name,
      category: parsed.data.category,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      note:
        parsed.data.note && parsed.data.note.length > 0
          ? parsed.data.note
          : "Administrator-added campus place",
      createdAt: new Date().toISOString(),
    };

    customPlaces.push(created);
    res.status(201).json(created);
  });

  app.put("/api/campus-places/:id", requireAdmin, (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || id.length > 80) {
      res.status(400).json({ error: "Invalid place ID." });
      return;
    }

    const parsed = PlacePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: "Provide a valid place name, category, latitude, and longitude.",
      });
      return;
    }

    const customIdx = customPlaces.findIndex((item) => item.id === id);
    const now = new Date().toISOString();

    if (customIdx !== -1) {
      const existing = customPlaces[customIdx]!;
      const updated: StoredCampusPlace = {
        ...existing,
        name: parsed.data.name,
        category: parsed.data.category,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        note:
          parsed.data.note && parsed.data.note.length > 0
            ? parsed.data.note
            : existing.note,
        updatedAt: now,
      };
      customPlaces[customIdx] = updated;
      res.json({ place: updated, isOverride: false });
      return;
    }

    const overridePlace: StoredCampusPlace = {
      id,
      name: parsed.data.name,
      category: parsed.data.category,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      note:
        parsed.data.note && parsed.data.note.length > 0
          ? parsed.data.note
          : "Administrator-verified campus pin",
      createdAt: now,
      updatedAt: now,
    };
    placeOverrides.set(id, overridePlace);
    res.json({ place: overridePlace, isOverride: true });
  });

  app.delete("/api/campus-places/:id", requireAdmin, (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ error: "Invalid place ID." });
      return;
    }

    const index = customPlaces.findIndex((item) => item.id === id);
    if (index !== -1) {
      customPlaces.splice(index, 1);
      res.json({ ok: true, id, kind: "custom" });
      return;
    }

    if (placeOverrides.delete(id)) {
      res.json({ ok: true, id, kind: "override-reset" });
      return;
    }

    res.status(404).json({ error: "Campus place or override not found." });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        allowedHosts: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
      root: __dirname,
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`EYE-CU running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
