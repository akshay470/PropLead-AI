import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "Google API Key", regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: "GitHub Personal Access Token", regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/ },
  { name: "OpenAI Secret Key", regex: /sk-[A-Za-z0-9]{32,}/ },
  { name: "AWS Access Key ID", regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
  { name: "Private RSA/EC/SSH Key", regex: /-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----/ },
  { name: "Slack Token", regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/ },
  { name: "Live Database URL with Credentials", regex: /postgres:\/\/(?!postgres:postgres|user:pass|username:password)[a-zA-Z0-9_-]+:[^@\s]{4,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\// },
];

console.log("🔍 Scanning git history and working tree for leaked credentials...");

let findings = 0;

// 1. Scan full git commit log
try {
  const gitLog = execSync("git log -p", { maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" });
  for (const pattern of PATTERNS) {
    const matches = gitLog.match(pattern.regex);
    if (matches) {
      console.error(`❌ Leak detected in git history: ${pattern.name} (${matches.length} matches)`);
      findings++;
    }
  }
} catch (err) {
  console.error("Failed to inspect git history:", err);
}

// 2. Scan tracked git files
try {
  const trackedFiles = execSync("git ls-files", { encoding: "utf-8" }).trim().split("\n");
  for (const rawFile of trackedFiles) {
    const file = rawFile.trim();
    if (!file || file.includes("scan-secrets")) continue;
    try {
      const fullPath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.size > 2 * 1024 * 1024) continue; // skip huge binaries
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(content)) {
          console.error(`❌ Leak detected in tracked file ${file}: ${pattern.name}`);
          findings++;
        }
      }
    } catch {
      // ignore binary or unreadable files
    }
  }
} catch (err) {
  console.error("Failed to scan tracked files:", err);
}

if (findings === 0) {
  console.log("✅ Zero leaked credentials or live API keys detected in git history or working tree.");
} else {
  console.error(`❌ Total leaks found: ${findings}`);
  process.exit(1);
}
