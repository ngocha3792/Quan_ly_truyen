#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

const rules = [
  {
    targets: ["frontend/src/app"],
    include: (file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"),
    pattern: /TruyenHub/u,
    message:
      "Frontend brand identity must come from core/config/app-identity.constants.ts.",
  },
  {
    targets: ["backend/src"],
    include: (file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"),
    pattern: /api\/v1/u,
    message:
      "Backend route prefixes must use API_PREFIX from common/constants.",
  },
  {
    targets: ["backend/src"],
    include: (file) => file.endsWith(".request.ts"),
    pattern: /page(?:Size)?(?:\s*:\s*number)?\s*=\s*(?:1|20)\b/u,
    message:
      "Request pagination defaults must use DEFAULT_PAGE and DEFAULT_PAGE_LIMIT.",
  },
  {
    targets: [
      "backend/src/config/cloudinary.config.ts",
      "backend/src/modules/media/infrastructure",
      "backend/scripts/ci/provision-cloudinary.ts",
      "backend/scripts/ci/verify-cloudinary-config.ts",
    ],
    pattern: /qlt_[a-z_]+_signed/u,
    message:
      "Cloudinary preset names must use CLOUDINARY_UPLOAD_PRESET_DEFAULTS.",
  },
];

const errors = [];

for (const rule of rules) {
  for (const target of rule.targets) {
    const absoluteTarget = path.join(repositoryRoot, target);
    for (const file of await collectFiles(absoluteTarget)) {
      if (rule.include && !rule.include(file)) continue;
      const content = await readFile(file, "utf8");
      if (rule.pattern.test(content)) {
        errors.push(`${path.relative(repositoryRoot, file)}: ${rule.message}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Centralized constants check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.info("Centralized constants check OK.");

async function collectFiles(target) {
  const entries = await readdir(target, { withFileTypes: true }).catch(
    (error) => {
      if (error?.code === "ENOTDIR") return null;
      throw error;
    },
  );

  if (entries === null) return [target];

  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(target, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}
