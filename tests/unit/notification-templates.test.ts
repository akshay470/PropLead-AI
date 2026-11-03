import { describe, it, expect } from "vitest";
import {
  notificationTemplates,
  NOTIFICATION_TEMPLATE_VERSION,
  buildMapsLink,
} from "@/server/services/notifications/templates";
import { createIstDate } from "@/lib/timezone";

describe("Notification Message Templates & Statutory Disclosures", () => {
  const sampleContext = {
    leadName: "Hardik Patel",
    projectName: "Project 1 (The Grand Orchard)",
    projectAddress: "SG Highway, Bodakdev, Ahmedabad",
    projectLat: "23.0338000",
    projectLng: "72.5072000",
    projectRera: "PR/GJ/AHMEDABAD/DEMO-0001",
    startsAt: createIstDate(2026, 11, 4, 11, 0, 0), // Nov 4, 11:00 AM IST
    executiveName: "Rajesh Sharma",
  };

  it("exports a semver template version string", () => {
    expect(NOTIFICATION_TEMPLATE_VERSION).toMatch(/^v\d+\.\d+\.\d+/);
    expect(notificationTemplates.version).toBe(NOTIFICATION_TEMPLATE_VERSION);
  });

  it("1-day reminder contains RERA number, IST time, executive name, and opt-out line", () => {
    const body = notificationTemplates.visitReminder1Day(sampleContext);

    // 1. RERA registration number
    expect(body).toContain("PR/GJ/AHMEDABAD/DEMO-0001");
    // 2. IST time
    expect(body).toMatch(/11:00\s*(am|AM)\s*IST/);
    // 3. Opt-out instruction
    expect(body).toContain("Reply STOP to opt out");
    // 4. Executive name & Project name
    expect(body).toContain("Rajesh Sharma");
    expect(body).toContain("The Grand Orchard");
    // 5. Google Maps Link
    expect(body).toContain("https://www.google.com/maps/search/?api=1&query=23.0338000,72.5072000");
    // 6. Template version
    expect(body).toContain(`[${NOTIFICATION_TEMPLATE_VERSION}]`);
  });

  it("2-hours reminder contains RERA number, IST time, and opt-out line", () => {
    const body = notificationTemplates.visitReminder2Hours(sampleContext);

    expect(body).toContain("PR/GJ/AHMEDABAD/DEMO-0001");
    expect(body).toMatch(/11:00\s*(am|AM)\s*IST/);
    expect(body).toContain("Reply STOP to opt out");
    expect(body).toContain("Rajesh Sharma");
    expect(body).toContain("in 2 hours");
    expect(body).toContain(`[${NOTIFICATION_TEMPLATE_VERSION}]`);
  });

  it("booking confirmation contains RERA number, IST time, and opt-out line", () => {
    const body = notificationTemplates.bookingConfirmation(sampleContext);

    expect(body).toContain("PR/GJ/AHMEDABAD/DEMO-0001");
    expect(body).toMatch(/11:00\s*(am|AM)\s*IST/);
    expect(body).toContain("Reply STOP to opt out");
    expect(body).toContain("confirmed");
  });

  it("opt-out confirmation explicitly acknowledges DPDP Act 2023", () => {
    const body = notificationTemplates.optOutConfirmation("Sameer Dave");

    expect(body).toContain("Sameer Dave");
    expect(body).toContain("DPDP Act 2023");
    expect(body).toContain("ceased immediately");
  });

  it("buildMapsLink correctly generates Google Maps coordinates query", () => {
    const link = buildMapsLink("23.0338", "72.5072");
    expect(link).toBe("https://www.google.com/maps/search/?api=1&query=23.0338,72.5072");
  });
});
