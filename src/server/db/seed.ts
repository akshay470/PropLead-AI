import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

// 1. Load env from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// 2. Validate DATABASE_URL when not in test
const databaseUrl = process.env.DATABASE_URL;
const isTest = process.env.NODE_ENV === "test";

if (!isTest) {
  if (!databaseUrl || databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
    console.error(
      "❌ Error: DATABASE_URL is missing or points to localhost/127.0.0.1.\n" +
      "Hint: Set DATABASE_URL in .env.local (see .env.example)"
    );
    process.exit(1);
  }
}

import { db } from "./index";
import {
  users,
  projects,
  leads,
  adSpend,
  factSheetEntries,
  visitSlots,
  bookings,
  reminders,
  executiveProjects,
} from "./schema";
import { hashPassword } from "../auth/passwords";
import { findDuplicate, DedupeLeadRecord } from "../services/leads/deduplication";
import { createIstDate, getIstParts, getIstTomorrow } from "@/lib/timezone";
import { eq, sql } from "drizzle-orm";

const FIXED_DEMO_PASSWORD = "DemoPass123!";

export async function runSeed() {
  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      "❌ Error: Database seeding requires ALLOW_SEED=true in environment variables.\n" +
      "Hint: Set ALLOW_SEED=true in .env.local (see .env.example)"
    );
    process.exit(1);
  }

  console.log("🌱 Starting PropLead AI database seed...");

  const now = new Date();

  // Helper for dates relative to now
  const daysAgo = (days: number, hours = 0, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours, d.getMinutes() - minutes, 0, 0);
    return d;
  };

  const daysAhead = (days: number, hours = 10, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // 1. CLEANUP (Idempotency)
  console.log("🧹 Resetting existing tables...");
  await db.delete(executiveProjects);
  await db.delete(reminders);
  await db.delete(bookings);
  await db.delete(visitSlots);
  await db.delete(factSheetEntries);
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

  // 8. SEED FACT SHEET ENTRIES (Project 1 & Project 2)
  console.log("📖 Seeding verified RERA fact sheet entries for AI grounding...");
  const factSheets = [
    // Project 1
    {
      projectId: project1.id,
      category: "Overview",
      questionKey: "overview",
      answerText:
        "The Grand Orchard is a premium residential enclave developed by Company A, situated in Bodakdev, Ahmedabad. The project spans 3.5 acres featuring 3 high-rise towers of G+22 floors with 220 luxury apartments designed for sustainable urban living.",
    },
    {
      projectId: project1.id,
      category: "Unit Types",
      questionKey: "unit_types",
      answerText:
        "Project 1 offers 2 BHK and 3 BHK luxury residences. 2 BHK units feature carpet areas ranging from 740 sq.ft to 810 sq.ft. 3 BHK units feature carpet areas ranging from 1,060 sq.ft to 1,220 sq.ft.",
    },
    {
      projectId: project1.id,
      category: "Pricing",
      questionKey: "pricing",
      answerText:
        "Indicative price band for Project 1: 2 BHK residences range from Rs 75 Lakh to Rs 88 Lakh; 3 BHK residences range from Rs 98 Lakh to Rs 1.20 Crore depending on floor and orientation. Final prices are determined exclusively by official sales agreements upon booking. No discounts or unapproved schemes are offered.",
    },
    {
      projectId: project1.id,
      category: "Amenities",
      questionKey: "amenities",
      answerText:
        "Residents enjoy an exclusive 15,000 sq.ft clubhouse, temperature-controlled indoor swimming pool, high-tech fitness gymnasium, squash court, rooftop sky lounge, children's themed play area, reflexology walking track, and 24/7 multi-tier security.",
    },
    {
      projectId: project1.id,
      category: "Location",
      questionKey: "location",
      answerText:
        "Prime location on SG Highway, Bodakdev, Ahmedabad. Located 400 meters from Iscon Cross Road, 1.2 km from SG Highway BRTS hub, 2 km from Zydus Hospital, and 3.5 km from leading schools.",
    },
    {
      projectId: project1.id,
      category: "Possession",
      questionKey: "possession",
      answerText:
        "RERA registered possession date is December 2026. Construction is progressing as per AUDA and RERA milestone schedules.",
    },
    {
      projectId: project1.id,
      category: "RERA Details",
      questionKey: "rera_number",
      answerText:
        "Gujarat RERA Registration Number: PR/GJ/AHMEDABAD/DEMO-0001. All approvals and approved plans can be verified on the official Gujarat RERA portal at gujrera.gujarat.gov.in.",
    },
    {
      projectId: project1.id,
      category: "Visit Guidelines",
      questionKey: "visit_timings",
      answerText:
        "The Experience Centre and model apartments are open Monday through Saturday from 10:00 AM to 6:00 PM (last appointment at 5:00 PM). Please carry a valid Government-issued photo ID for visitor pass registration.",
    },
    {
      projectId: project1.id,
      category: "Parking",
      questionKey: "parking",
      answerText:
        "Each 2 BHK includes 1 designated covered basement parking bay. 3 BHK units include 2 allotted parking bays.",
    },
    {
      projectId: project1.id,
      category: "Loan Assistance",
      questionKey: "loan_assistance",
      answerText:
        "Comprehensive home loan facilitation is available through leading approved nationalized and private banking institutions offering competitive interest rates.",
    },
    {
      projectId: project1.id,
      category: "Contact Policy",
      questionKey: "contact_policy",
      answerText:
        "All prospective buyer interactions require prior affirmative consent under DPDP Act 2023. A dedicated relationship executive is assigned upon site visit confirmation.",
    },

    // Project 2
    {
      projectId: project2.id,
      category: "Overview",
      questionKey: "overview",
      answerText:
        "Serene Meadows is a modern lifestyle community by Company A located in South Bopal / Shela extension, Ahmedabad. Set across 4.2 acres with 4 towers of G+18 floors and 200 thoughtfully planned residences.",
    },
    {
      projectId: project2.id,
      category: "Unit Types",
      questionKey: "unit_types",
      answerText:
        "Project 2 features contemporary 2 BHK and 3 BHK family homes. 2 BHK carpet areas range from 680 sq.ft to 750 sq.ft. 3 BHK carpet areas range from 980 sq.ft to 1,120 sq.ft.",
    },
    {
      projectId: project2.id,
      category: "Pricing",
      questionKey: "pricing",
      answerText:
        "Indicative price band for Project 2: 2 BHK residences range from Rs 65 Lakh to Rs 76 Lakh; 3 BHK residences range from Rs 85 Lakh to Rs 1.05 Crore. Final terms are established strictly via formal developer agreements.",
    },
    {
      projectId: project2.id,
      category: "Amenities",
      questionKey: "amenities",
      answerText:
        "Community clubhouse with multipurpose banquet hall, open-air swimming pool with kids' splash pool, gymnasium, badminton court, yoga and meditation lawn, landscaped senior citizen garden, and EV charging bays.",
    },
    {
      projectId: project2.id,
      category: "Location",
      questionKey: "location",
      answerText:
        "Situated on Club O7 Road, Shela, Ahmedabad. 5 minutes from South Bopal main ring road, 10 minutes from SP Ring Road, and close to reputable international schools and healthcare centers.",
    },
    {
      projectId: project2.id,
      category: "Possession",
      questionKey: "possession",
      answerText:
        "RERA registered possession date is June 2027. Foundations and podium structures are fully completed.",
    },
    {
      projectId: project2.id,
      category: "RERA Details",
      questionKey: "rera_number",
      answerText:
        "Gujarat RERA Registration Number: PR/GJ/AHMEDABAD/DEMO-0002. Public disclosures and verified project documents are accessible on gujrera.gujarat.gov.in.",
    },
    {
      projectId: project2.id,
      category: "Visit Guidelines",
      questionKey: "visit_timings",
      answerText:
        "Sales gallery operates Monday to Saturday, 10:00 AM to 6:00 PM (last slot 5:00 PM). Prior appointment booking is recommended to guarantee executive availability.",
    },
    {
      projectId: project2.id,
      category: "Parking",
      questionKey: "parking",
      answerText:
        "Secure basement and stilt parking slots are allotted with every residential unit.",
    },
    {
      projectId: project2.id,
      category: "Loan Assistance",
      questionKey: "loan_assistance",
      answerText:
        "Standard home loan advisory and documentation assistance are provided through major authorized financial institutions.",
    },
    {
      projectId: project2.id,
      category: "Contact Policy",
      questionKey: "contact_policy",
      answerText:
        "Communications strictly follow buyer consent guidelines. You may opt out at any time by messaging STOP.",
    },
  ];

  await db.insert(factSheetEntries).values(factSheets);

  // 9. SEED EXECUTIVE PROJECT COVERAGE
  console.log("👥 Assigning sales executives to project coverage...");
  await db.insert(executiveProjects).values([
    { executiveId: executiveUsers[0].id, projectId: project1.id },
    { executiveId: executiveUsers[1].id, projectId: project1.id },
    { executiveId: executiveUsers[2].id, projectId: project2.id },
    { executiveId: executiveUsers[3].id, projectId: project2.id },
  ]);

  // 10. SEED VISIT SLOTS & BOOKINGS (Strictly Asia/Kolkata Business Hours: 10:00 to 18:00 IST)
  console.log("📅 Generating calendar slots and confirmed bookings in Asia/Kolkata (IST)...");

  // Project 1 executives: Rajesh Sharma (0) and Ananya Shah (1)
  // Project 2 executives: Priya Patel (2) and Amit Joshi (3)
  const execCoverage = [
    { exec: executiveUsers[0], project: project1 },
    { exec: executiveUsers[1], project: project1 },
    { exec: executiveUsers[2], project: project2 },
    { exec: executiveUsers[3], project: project2 },
  ];

  const slotHours = [10, 11, 12, 14, 15, 16, 17]; // 10:00 to 18:00 IST (last slot at 17:00 IST)
  const nowParts = getIstParts(now);

  // A. Generate future slots for next 14 days in IST (excluding Sundays)
  const futureSlotsToInsert = [];
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    // Check weekday in IST
    const testDate = createIstDate(nowParts.year, nowParts.month, nowParts.day + dayOffset, 12, 0, 0);
    const { weekday } = getIstParts(testDate);
    if (weekday === "Sun") continue;

    for (const coverage of execCoverage) {
      for (const hour of slotHours) {
        const startsAt = createIstDate(nowParts.year, nowParts.month, nowParts.day + dayOffset, hour, 0, 0);
        const endsAt = createIstDate(nowParts.year, nowParts.month, nowParts.day + dayOffset, hour + 1, 0, 0);

        futureSlotsToInsert.push({
          projectId: coverage.project.id,
          executiveId: coverage.exec.id,
          startsAt,
          endsAt,
          status: "available" as const,
        });
      }
    }
  }

  const insertedFutureSlots = await db
    .insert(visitSlots)
    .values(futureSlotsToInsert)
    .returning();

  // B. Seed LD-58210 Hardik Patel's booking tomorrow at 11:00 AM IST with Rajesh Sharma (Project 1)
  const tomorrow11AM = getIstTomorrow(11, 0, now);

  // Find the exact matching slot in insertedFutureSlots
  const hardikSlot = insertedFutureSlots.find(
    (s) =>
      s.executiveId === executiveUsers[0].id &&
      s.projectId === project1.id &&
      new Date(s.startsAt).getTime() === tomorrow11AM.getTime()
  );

  if (hardikSlot) {
    const [hardikBooking] = await db
      .insert(bookings)
      .values({
        slotId: hardikSlot.id,
        leadId: leadHardik.id,
        status: "confirmed",
      })
      .returning();

    // Create 1-day reminder for Hardik's visit
    const reminder1Day = new Date(tomorrow11AM.getTime() - 24 * 3600 * 1000);
    await db.insert(reminders).values({
      bookingId: hardikBooking.id,
      type: "1_day",
      scheduledAt: reminder1Day,
      status: "pending",
    });

    console.log(`  ✓ LD-58210 booked slot ${hardikSlot.id} for tomorrow 11:00 AM IST (Taken, not free)`);
  }

  // C. Seed past visit slots & bookings for the last 30 days (All strictly IST)
  // Seed Kavita Joshi's visit yesterday at 16:00 IST (visited)
  const yesterday16SlotStart = createIstDate(nowParts.year, nowParts.month, nowParts.day - 1, 16, 0, 0);
  const yesterday16SlotEnd = createIstDate(nowParts.year, nowParts.month, nowParts.day - 1, 17, 0, 0);

  const [kavitaSlot] = await db
    .insert(visitSlots)
    .values({
      projectId: project2.id,
      executiveId: executiveUsers[2].id,
      startsAt: yesterday16SlotStart,
      endsAt: yesterday16SlotEnd,
      status: "booked",
    })
    .returning();

  await db.insert(bookings).values({
    slotId: kavitaSlot.id,
    leadId: leadKavita.id,
    status: "visited",
    createdAt: daysAgo(5),
  });

  // Seed 12 more past visits from the seeded leads (mix of visited and no_show)
  const pastSampleLeads = seededLeads.slice(3, 15);
  for (let idx = 0; idx < pastSampleLeads.length; idx++) {
    const leadRecord = pastSampleLeads[idx];
    const pastDay = (idx * 2) + 2;
    const slotStart = createIstDate(nowParts.year, nowParts.month, nowParts.day - pastDay, 14, 0, 0);
    const slotEnd = createIstDate(nowParts.year, nowParts.month, nowParts.day - pastDay, 15, 0, 0);
    const exec = executiveUsers[idx % executiveUsers.length];
    const proj = idx % 2 === 0 ? project1 : project2;
    const outcome = idx % 3 === 0 ? ("no_show" as const) : ("visited" as const);

    const [pastSlot] = await db
      .insert(visitSlots)
      .values({
        projectId: proj.id,
        executiveId: exec.id,
        startsAt: slotStart,
        endsAt: slotEnd,
        status: "booked",
      })
      .returning();

    await db.insert(bookings).values({
      slotId: pastSlot.id,
      leadId: leadRecord.id,
      status: outcome,
      createdAt: daysAgo(pastDay + 3),
    });
  }

  console.log("\n==================================================");
  console.log("✨ PropLead AI Seed Complete!");
  console.log("==================================================");
  console.log("🏢 Projects Seeded: 2 (Project 1 & Project 2)");
  console.log("📖 Fact Sheet Entries Seeded: 22 (11 verified categories per project)");
  console.log(`📋 Total Leads Seeded: ${seededLeads.length} (including duplicates & exact test leads)`);
  console.log(`📅 Visit Slots Seeded: ${insertedFutureSlots.length + 13} across next 14 days + past 30 days`);
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
