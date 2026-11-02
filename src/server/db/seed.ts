import { db } from "./index";
import { users, projects, leads, adSpend } from "./schema";
import { hashPassword } from "../auth/passwords";
import { findDuplicate, DedupeLeadRecord } from "../services/leads/deduplication";
import { eq, sql } from "drizzle-orm";

const FIXED_DEMO_PASSWORD = "DemoPass123!";

export async function runSeed() {
  console.log("🌱 Starting PropLead AI database seed...");

  const now = new Date();

  // Helper for dates relative to now
  const daysAgo = (days: number, hours = 0, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours, d.getMinutes() - minutes, 0, 0);
    return d;
  };

  const tomorrowAt = (hour = 11, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const yesterdayAt = (hour = 16, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // 1. CLEANUP (Idempotency)
  console.log("🧹 Resetting existing tables...");
  await db.delete(adSpend);
  await db.delete(leads);
  await db.delete(projects);
  await db.delete(users);

  // 2. SEED USERS
  console.log("👤 Creating internal staff & demo buyer accounts...");
  const passwordHash = await hashPassword(FIXED_DEMO_PASSWORD);

  const [adminUser] = await db
    .insert(users)
    .values({
      name: "Vikram Mehta (Sales Head)",
      email: "admin@example.com",
      passwordHash,
      role: "admin",
      isAdmin: true,
    })
    .returning();

  const executiveUsers = await db
    .insert(users)
    .values([
      {
        name: "Rajesh Sharma",
        email: "rajesh@example.com",
        passwordHash,
        role: "executive",
        isAdmin: false,
      },
      {
        name: "Ananya Shah",
        email: "ananya@example.com",
        passwordHash,
        role: "executive",
        isAdmin: false,
      },
      {
        name: "Priya Patel",
        email: "priya@example.com",
        passwordHash,
        role: "executive",
        isAdmin: false,
      },
      {
        name: "Amit Joshi",
        email: "amit@example.com",
        passwordHash,
        role: "executive",
        isAdmin: false,
      },
    ])
    .returning();

  const [demoBuyer] = await db
    .insert(users)
    .values({
      name: "Sameer Dave",
      email: "buyer@example.com",
      passwordHash,
      role: "buyer",
      isAdmin: false,
    })
    .returning();

  // 3. SEED 2 PROJECTS
  console.log("🏢 Seeding Company A residential projects...");
  const [project1, project2] = await db
    .insert(projects)
    .values([
      {
        name: "Project 1 (The Grand Orchard)",
        reraNumber: "PR/GJ/AHMEDABAD/DEMO-0001",
        locationName: "SG Highway, Bodakdev",
        lat: "23.0338000",
        lng: "72.5072000",
        address: "Near Iscon Cross Road, SG Highway, Bodakdev, Ahmedabad, Gujarat 380054",
      },
      {
        name: "Project 2 (Serene Meadows)",
        reraNumber: "PR/GJ/AHMEDABAD/DEMO-0002",
        locationName: "South Bopal / Shela",
        lat: "23.0125000",
        lng: "72.4589000",
        address: "Club O7 Road, South Bopal Extn, Shela, Ahmedabad, Gujarat 380058",
      },
    ])
    .returning();

  // 4. SEED THE 3 EXACT SAMPLE LEADS
  console.log("🎯 Seeding the 3 required core sample leads...");
  const seededLeads: DedupeLeadRecord[] = [];

  // Exact lead 1: LD-58210 Hardik Patel, Property portal, Project 1, 3 BHK, visit booked
  const [leadHardik] = await db
    .insert(leads)
    .values({
      leadCode: "LD-58210",
      name: "Hardik Patel",
      phoneE164: "+919825012345",
      email: "hardik.patel@example.com",
      source: "property_portal",
      projectId: project1.id,
      wants: "3BHK",
      budgetMin: 8500000,
      budgetMax: 11000000,
      language: "gu",
      consentGiven: true,
      optedOut: false,
      assignedExecutiveId: executiveUsers[0].id,
      status: "visit_scheduled",
      firstResponseAt: daysAgo(2, 0, 2), // 2 min response
      createdAt: daysAgo(2, 0, 4),
    })
    .returning();

  seededLeads.push({
    id: leadHardik.id,
    leadCode: leadHardik.leadCode,
    name: leadHardik.name,
    phoneE164: leadHardik.phoneE164,
    email: leadHardik.email,
    createdAt: leadHardik.createdAt,
    duplicateOfId: leadHardik.duplicateOfId,
    optedOut: leadHardik.optedOut,
  });

  // Exact lead 2: LD-58211 Nidhi Shah, Social media ad, Project 2, 2 BHK, not booked
  const [leadNidhi] = await db
    .insert(leads)
    .values({
      leadCode: "LD-58211",
      name: "Nidhi Shah",
      phoneE164: "+919825098765",
      email: "nidhi.shah@example.com",
      source: "social_media_ad",
      projectId: project2.id,
      wants: "2BHK",
      budgetMin: 6500000,
      budgetMax: 8000000,
      language: "en",
      consentGiven: true,
      optedOut: false,
      assignedExecutiveId: executiveUsers[1].id,
      status: "qualified",
      firstResponseAt: daysAgo(4, 3, 30), // 3.5 hours later
      createdAt: daysAgo(4, 7, 0),
    })
    .returning();

  seededLeads.push({
    id: leadNidhi.id,
    leadCode: leadNidhi.leadCode,
    name: leadNidhi.name,
    phoneE164: leadNidhi.phoneE164,
    email: leadNidhi.email,
    createdAt: leadNidhi.createdAt,
    duplicateOfId: leadNidhi.duplicateOfId,
    optedOut: leadNidhi.optedOut,
  });

  // Exact lead 3: LD-58224 Kavita Joshi, Hoarding call, Project 2, 2 BHK, visited (past visit)
  const [leadKavita] = await db
    .insert(leads)
    .values({
      leadCode: "LD-58224",
      name: "Kavita Joshi",
      phoneE164: "+919825044444",
      email: "kavita.joshi@example.com",
      source: "hoarding_call",
      projectId: project2.id,
      wants: "2BHK",
      budgetMin: 7000000,
      budgetMax: 8500000,
      language: "hi",
      consentGiven: true,
      optedOut: false,
      assignedExecutiveId: executiveUsers[2].id,
      status: "visited",
      firstResponseAt: daysAgo(10, 0, 1), // 1 min response
      createdAt: daysAgo(10, 0, 2),
    })
    .returning();

  seededLeads.push({
    id: leadKavita.id,
    leadCode: leadKavita.leadCode,
    name: leadKavita.name,
    phoneE164: leadKavita.phoneE164,
    email: leadKavita.email,
    createdAt: leadKavita.createdAt,
    duplicateOfId: leadKavita.duplicateOfId,
    optedOut: leadKavita.optedOut,
  });

  // 5. SEED ~80 REALISTIC FAKE LEADS
  console.log("📊 Seeding ~80 varied leads across all sources, projects, and statuses...");

  const firstNames = [
    "Chirag", "Bhavin", "Mehul", "Hitesh", "Parth", "Kunal", "Sneha", "Pooja",
    "Riddhi", "Dhaval", "Manish", "Gaurav", "Kinjal", "Jinal", "Swati", "Ketan",
    "Ankit", "Rohan", "Tushar", "Deepak", "Vikas", "Ashok", "Sanjay", "Nehal",
    "Urvashi", "Pratik", "Jayesh", "Alok", "Varun", "Rahul", "Tanvi", "Avani",
    "Maitri", "Harsh", "Dipen", "Suresh", "Mahesh", "Kalpesh", "Viral", "Pankaj"
  ];
  const lastNames = [
    "Mehta", "Shah", "Patel", "Panchal", "Desai", "Trivedi", "Vora", "Bhatt",
    "Modi", "Chauhan", "Gajjar", "Soni", "Pandya", "Raval", "Barot", "Solanki"
  ];

  const sources = [
    "property_portal",
    "social_media_ad",
    "website",
    "hoarding_call",
  ] as const;

  const statuses = [
    "new",
    "contacted",
    "qualified",
    "visit_scheduled",
    "visited",
    "lost",
  ] as const;

  const languages = ["en", "hi", "gu"] as const;

  let currentLeadNumber = 58225;

  for (let i = 0; i < 78; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[(i * 3) % lastNames.length];
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const phoneSuffix = String(100000 + i * 113).slice(-6);
    const phoneE164 = `+919825${phoneSuffix}`;

    const source = sources[i % sources.length];
    const project = i % 2 === 0 ? project1 : project2;
    const wants = i % 3 === 0 ? "3BHK" : "2BHK";
    const budgetMin = wants === "3BHK" ? 9000000 : 6500000;
    const budgetMax = wants === "3BHK" ? 12000000 : 8500000;
    const language = languages[i % languages.length];
    const status = statuses[i % statuses.length];

    // Compliance edge cases: 3 opted out, 4 without consent
    const isOptedOut = i >= 10 && i <= 12;
    const hasConsent = i < 74; // Last 4 don't have consent

    const daysPrior = (i % 30) + 1;
    const createdAt = daysAgo(daysPrior, (i * 2) % 24, (i * 7) % 60);

    // Realistic response times:
    // ~25% answered under 2 min, ~45% delayed by several hours, ~30% never reached
    let firstResponseAt: Date | null = null;
    if (i % 4 === 0) {
      // Fast assistant response (< 2 mins)
      firstResponseAt = new Date(createdAt.getTime() + (45 + (i % 60)) * 1000);
    } else if (i % 4 === 1 || i % 4 === 2) {
      // Delayed human telecaller response (3h to 16h)
      firstResponseAt = new Date(createdAt.getTime() + (3 + (i % 12)) * 3600 * 1000);
    } else {
      // Never reached (null)
      firstResponseAt = null;
    }

    const assignedExecutive =
      status === "new" ? null : executiveUsers[i % executiveUsers.length];

    const leadCode = `LD-${currentLeadNumber++}`;

    const [created] = await db
      .insert(leads)
      .values({
        leadCode,
        name: fullName,
        phoneE164,
        email,
        source,
        projectId: project.id,
        wants,
        budgetMin,
        budgetMax,
        language,
        consentGiven: hasConsent,
        optedOut: isOptedOut,
        assignedExecutiveId: assignedExecutive?.id || null,
        status,
        firstResponseAt,
        createdAt,
      })
      .returning();

    seededLeads.push({
      id: created.id,
      leadCode: created.leadCode,
      name: created.name,
      phoneE164: created.phoneE164,
      email: created.email,
      createdAt: created.createdAt,
      duplicateOfId: null,
      optedOut: created.optedOut,
    });
  }

  // 6. SEED 7 DELIBERATE DUPLICATES USING REAL DEDUPE LOGIC
  console.log("🔗 Processing 7 deliberate duplicates through real deduplication engine...");

  const duplicateScenarios = [
    // Duplicate 1: Hardik Patel re-inquiring from Social Media with leading 0 phone format
    {
      name: "Hardik Patel",
      phoneRaw: "09825012345",
      email: "HARDIK.PATEL@EXAMPLE.COM", // uppercase email
      source: "social_media_ad" as const,
      project: project1,
      wants: "3BHK",
    },
    // Duplicate 2: Hardik Patel re-inquiring from Website with spaced +91 format
    {
      name: "Hardik P.",
      phoneRaw: "+91 98250 12345",
      email: "hardik.patel@example.com",
      source: "website" as const,
      project: project1,
      wants: "3BHK",
    },
    // Duplicate 3: Nidhi Shah inquiring on hoarding number without country code
    {
      name: "Nidhi Shah",
      phoneRaw: "9825098765",
      email: "nidhi.shah@example.com",
      source: "hoarding_call" as const,
      project: project2,
      wants: "2BHK",
    },
    // Duplicate 4: Kavita Joshi submitting website form with spaces in phone
    {
      name: "Kavita Joshi",
      phoneRaw: " (09825) 044-444 ",
      email: "kavita.joshi@example.com",
      source: "website" as const,
      project: project2,
      wants: "2BHK",
    },
    // Duplicate 5: Lead 10 re-submitting with dashed phone
    {
      name: seededLeads[3].name,
      phoneRaw: seededLeads[3].phoneE164.replace("+91", "+91-"),
      email: seededLeads[3].email,
      source: "property_portal" as const,
      project: project1,
      wants: "2BHK",
    },
    // Duplicate 6: Lead 15 matching via email only
    {
      name: seededLeads[14].name,
      phoneRaw: "+919777112233", // different phone
      email: seededLeads[14].email?.toUpperCase(), // same email uppercase
      source: "social_media_ad" as const,
      project: project2,
      wants: "3BHK",
    },
    // Duplicate 7: Opted-out lead inquiring again (should inherit optedOut)
    {
      name: "Urvashi Trivedi",
      phoneRaw: seededLeads[11].phoneE164, // matches opted-out lead
      email: seededLeads[11].email,
      source: "website" as const,
      project: project2,
      wants: "2BHK",
    },
  ];

  for (const dup of duplicateScenarios) {
    // Run candidate through real deduplication engine!
    const dedupe = findDuplicate(
      {
        phone: dup.phoneRaw,
        email: dup.email,
        name: dup.name,
      },
      seededLeads
    );

    const leadCode = `LD-${currentLeadNumber++}`;

    const [dupLead] = await db
      .insert(leads)
      .values({
        leadCode,
        name: dup.name,
        phoneE164: dedupe.canonicalLead?.phoneE164 || "+919800000000",
        email: dup.email ? dup.email.toLowerCase().trim() : null,
        source: dup.source, // Keep distinct source attribution!
        projectId: dup.project.id,
        wants: dup.wants,
        language: "en",
        consentGiven: true,
        optedOut: dedupe.canonicalLead?.optedOut || false,
        duplicateOfId: dedupe.canonicalLead?.id || null, // Real linked canonical ID
        status: "new",
        createdAt: daysAgo(1, 1, 0),
      })
      .returning();

    seededLeads.push({
      id: dupLead.id,
      leadCode: dupLead.leadCode,
      name: dupLead.name,
      phoneE164: dupLead.phoneE164,
      email: dupLead.email,
      createdAt: dupLead.createdAt,
      duplicateOfId: dupLead.duplicateOfId,
      optedOut: dupLead.optedOut,
    });
  }

  // 7. SEED AD SPEND (Last 3 Months, ~Rs 30 Lakh/month across sources)
  console.log("💰 Seeding advertising spend records for cost-per-visit attribution...");
  const months = ["2026-09", "2026-10", "2026-11"];

  const spendMatrix = [
    { source: "property_portal" as const, amount: "1450000.00" }, // Rs 14.5L
    { source: "social_media_ad" as const, amount: "980000.00" },  // Rs 9.8L
    { source: "hoarding_call" as const, amount: "370000.00" },    // Rs 3.7L
    { source: "website" as const, amount: "200000.00" },          // Rs 2.0L
  ];

  for (const month of months) {
    for (const item of spendMatrix) {
      await db.insert(adSpend).values({
        source: item.source,
        month,
        amount: item.amount,
      });
    }
  }

  console.log("\n==================================================");
  console.log("✨ PropLead AI Seed Complete!");
  console.log("==================================================");
  console.log("🏢 Projects Seeded: 2 (Project 1 & Project 2)");
  console.log(`📋 Total Leads Seeded: ${seededLeads.length} (including duplicates & exact test leads)`);
  console.log("💰 Ad Spend Seeded: 3 Months across 4 channels (~Rs 30L/month)");
  console.log("--------------------------------------------------");
  console.log("🔑 DEMO LOGIN CREDENTIALS (All use password: " + FIXED_DEMO_PASSWORD + ")");
  console.log("  1. Admin (Sales Head):    admin@example.com");
  console.log("  2. Sales Executive 1:     rajesh@example.com");
  console.log("  3. Sales Executive 2:     ananya@example.com");
  console.log("  4. Sales Executive 3:     priya@example.com");
  console.log("  5. Sales Executive 4:     amit@example.com");
  console.log("  6. Demo Buyer:            buyer@example.com");
  console.log("==================================================\n");
}

// Allow direct CLI invocation via `pnpm run seed`
if (require.main === module || process.argv[1]?.includes("seed.ts")) {
  runSeed()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
