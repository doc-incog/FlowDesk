import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Paths that may only be read by the seed module and the temporary shims.
// Type-only imports are allowed everywhere so components can share types
// without pulling in mock values.
const SEED_PATHS = [
  "@/lib/seed-data",
  "@/lib/seed-data/admissions",
  "@/lib/seed-data/assignments",
  "@/lib/seed-data/chat",
  "@/lib/seed-data/core",
  "@/lib/seed-data/exams",
  "@/lib/seed-data/feedback",
  "@/lib/seed-data/fees",
  "@/lib/seed-data/helpdesk",
  "@/lib/seed-data/scholarships",
]

const seedBan = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: SEED_PATHS.map((name) => ({
          name,
          allowTypeImports: true,
          message:
            "Mock data lives in lib/seed-data and must only be read through the database. Import from lib/db or the API instead.",
        })),
      },
    ],
  },
}

// The seeder and the migration shims are the only files allowed to read values
// from lib/seed-data.
const seedBanAllowlist = {
  files: ["lib/db/seed.ts", "lib/mock-data.ts", "lib/data/*.ts"],
  rules: {
    "no-restricted-imports": "off",
  },
}

export default defineConfig([
  nextVitals,
  nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".data/**"]),
  seedBan,
  seedBanAllowlist,
])
