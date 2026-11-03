import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/server/auth/session";

describe("Route-Level Role-Based Access Control (RBAC) Security Matrix", () => {
  let buyerToken: string;
  let executiveToken: string;
  let adminToken: string;

  beforeAll(async () => {
    buyerToken = await createSessionToken({
      userId: "00000000-0000-0000-0000-000000000001",
      name: "Buyer User",
      email: "buyer@example.com",
      role: "buyer",
      isAdmin: false,
    });

    executiveToken = await createSessionToken({
      userId: "00000000-0000-0000-0000-000000000002",
      name: "Executive User",
      email: "executive@company.com",
      role: "executive",
      isAdmin: false,
    });

    adminToken = await createSessionToken({
      userId: "00000000-0000-0000-0000-000000000003",
      name: "Admin User",
      email: "admin@company.com",
      role: "admin",
      isAdmin: true,
    });
  });

  interface RouteMatrixTestCase {
    route: string;
    description: string;
    anonymousExpected: 401 | 200;
    buyerExpected: 403 | 200;
    executiveExpected: 403 | 200;
    adminExpected: 200;
  }

  const testMatrix: RouteMatrixTestCase[] = [
    // 1. Admin exclusive endpoints
    {
      route: "/api/admin/dashboard",
      description: "Admin analytics & source performance dashboard",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/facts",
      description: "Admin fact sheet manager",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/review",
      description: "Admin flagged chat review queue",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/slots",
      description: "Admin slot management grid",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/slots/generate",
      description: "Admin batch slot generation",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/slots/block",
      description: "Admin slot blackout / blocking",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/coverage",
      description: "Admin executive project coverage editor",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/messages",
      description: "Admin messaging audit logs",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/users",
      description: "Admin staff user provisioning",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },
    {
      route: "/api/admin/leads/00000000-0000-0000-0000-000000000000/anonymize",
      description: "Admin DPDP lead anonymization",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 403,
      adminExpected: 200,
    },

    // 2. Executive endpoints (Admins also allowed)
    {
      route: "/api/executive/dashboard",
      description: "Executive daily visits and assigned leads dashboard",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 200,
      adminExpected: 200,
    },
    {
      route: "/api/executive/visits",
      description: "Executive site visit calendar",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 200,
      adminExpected: 200,
    },
    {
      route: "/api/executive/handoffs",
      description: "Executive AI handoff queue",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 200,
      adminExpected: 200,
    },
    {
      route: "/api/executive/handoffs/00000000-0000-0000-0000-000000000000",
      description: "Executive specific handoff item resolution",
      anonymousExpected: 401,
      buyerExpected: 403,
      executiveExpected: 200,
      adminExpected: 200,
    },

    // 3. Public Endpoints
    {
      route: "/api/chat/start",
      description: "Public buyer chat start & session issuance",
      anonymousExpected: 200,
      buyerExpected: 200,
      executiveExpected: 200,
      adminExpected: 200,
    },
    {
      route: "/api/health",
      description: "Public service health check",
      anonymousExpected: 200,
      buyerExpected: 200,
      executiveExpected: 200,
      adminExpected: 200,
    },
  ];

  testMatrix.forEach((tc) => {
    describe(`${tc.route} (${tc.description})`, () => {
      it(`blocks/allows Anonymous with status ${tc.anonymousExpected}`, async () => {
        const req = new NextRequest(`http://localhost:3000${tc.route}`);
        const res = await middleware(req);
        const status = res.status;
        expect(status).toBe(tc.anonymousExpected);
      });

      it(`blocks/allows Buyer with status ${tc.buyerExpected}`, async () => {
        const req = new NextRequest(`http://localhost:3000${tc.route}`);
        req.cookies.set(SESSION_COOKIE_NAME, buyerToken);
        const res = await middleware(req);
        const status = res.status;
        expect(status).toBe(tc.buyerExpected);
      });

      it(`blocks/allows Executive with status ${tc.executiveExpected}`, async () => {
        const req = new NextRequest(`http://localhost:3000${tc.route}`);
        req.cookies.set(SESSION_COOKIE_NAME, executiveToken);
        const res = await middleware(req);
        const status = res.status;
        expect(status).toBe(tc.executiveExpected);
      });

      it(`allows Admin with status ${tc.adminExpected}`, async () => {
        const req = new NextRequest(`http://localhost:3000${tc.route}`);
        req.cookies.set(SESSION_COOKIE_NAME, adminToken);
        const res = await middleware(req);
        const status = res.status;
        expect(status).toBe(tc.adminExpected);
      });
    });
  });
});
