#!/usr/bin/env node
import { fileURLToPath } from "url"
import { execSync } from "child_process"
import path from "path"
import { createClient } from "@hey-api/openapi-ts"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const opencodeDir = path.resolve(dir, "../../opencode")

// Generate openapi.json from backend
execSync(`npx tsx ./src/index.ts generate > ${path.join(dir, "openapi.json")}`, { cwd: opencodeDir })

await createClient({
  input: "./openapi.json",
  output: {
    path: "./src/v2/gen",
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "OpencodeClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})

try {
  execSync(`npx prettier --write src/gen`)
} catch (e) {
  console.warn("Failed to run prettier on src/gen")
}

try {
  execSync(`npx prettier --write src/v2`)
} catch (e) {
  console.warn("Failed to run prettier on src/v2")
}

execSync(`rm -rf dist`)
execSync(`npx tsc`)
execSync(`rm openapi.json`)
