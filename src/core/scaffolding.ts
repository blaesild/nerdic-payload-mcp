import { ScaffoldProjectConfig } from "./types.js";
import { formatCode } from "./utils.js";

// 3. Project Scaffolding
export async function scaffoldProject(
  config: ScaffoldProjectConfig,
): Promise<Record<string, string>> {
  console.log(
    `MCP Core: Scaffolding project structure for: ${config.projectName}`,
  );
  // Generates file *content* for a basic Payload project (Next.js focus).
  // Adapt based on config.framework if provided.

  const files: Record<string, string> = {};
  const useTs = true;
  const ext = useTs ? "ts" : "js";

  // --- package.json ---
  // (Identical content generation logic as the integrated version)
  files["package.json"] = await formatCode(
    JSON.stringify(
      {
        /* ... package.json content ... */
      },
      null,
      2,
    ),
    "json",
  );
  // Ensure dependencies match Payload 3 requirements for Next.js or chosen framework
  // Adjust scripts based on framework (e.g., Next.js dev/build vs Express)

  // --- tsconfig.json ---
  // (Identical content generation logic as the integrated version)
  files["tsconfig.json"] = await formatCode(
    JSON.stringify(
      {
        /* ... tsconfig.json content ... */
      },
      null,
      2,
    ),
    "json",
  );
  // Ensure compilerOptions match Next.js (`jsx: 'preserve'`, `plugins: [{"name": "next"}]` etc.)

  // --- next.config.mjs (if framework is nextjs) ---
  if (config.framework === "nextjs" || !config.framework) {
    // Default to Next.js
    files["next.config.mjs"] = `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['payload'], // Adjust based on Payload 3 final recommendations
};
export default nextConfig;
`;
  }

  // --- .env ---
  // (Identical content generation logic)
  files[".env"] = `PAYLOAD_SECRET=REPLACE_WITH_STRONG_SECRET
${config.dbAdapter === "mongoose" ? "MONGODB_URI=mongodb://127.0.0.1/my-project" : "POSTGRES_URI=postgres://user:pass@host:port/db"}
${config.framework === "nextjs" ? "PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000" : "SERVER_URL=http://localhost:3000"} # Adjust port if needed
`;

  // --- src/payload.config.ts ---
  // (Identical content generation logic, ensuring db adapter code is correct)
  const dbAdapterImport =
    config.dbAdapter === "mongoose"
      ? "import { mongooseAdapter } from '@payloadcms/db-mongodb';"
      : "import { postgresAdapter } from '@payloadcms/db-postgres';";

  const dbAdapterCall =
    config.dbAdapter === "mongoose"
      ? "mongooseAdapter({ url: process.env.MONGODB_URI })"
      : "postgresAdapter({ pool: { connectionString: process.env.POSTGRES_URI } })";
  files[`src/payload.config.${ext}`] = await formatCode(
    `
import { buildConfig } from 'payload/config';
import path from 'path';
import Users from './collections/Users';
${config.includeExample ? `import Pages from './collections/Pages';` : ""}
import { slateEditor } from '@payloadcms/richtext-slate'; // Or lexical
${dbAdapterImport}
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const filename = fileURLToPath(import.meta.url);
const Pdirname = dirname(filename);

export default buildConfig({
  serverURL: process.env.SERVER_URL || 'http://localhost:3000', // Use generic SERVER_URL
  admin: { user: Users.slug },
  editor: slateEditor({}), // Or lexicalEditor
  collections: [ Users, ${config.includeExample ? "Pages," : ""} ],
  typescript: { outputFile: path.resolve(Pdirname, 'payload-types.${ext}') },
  graphQL: { schemaOutputFile: path.resolve(Pdirname, 'generated-schema.graphql') },
  db: ${dbAdapterCall},
  // plugins: [], // Add plugin stubs if requested
});
`,
    "typescript",
  );

  // --- Basic Collections (Users, optional Pages) ---
  // (Identical content generation logic)
  files[`src/collections/Users.${ext}`] = await formatCode(
    `/* ... Users collection code ... */`,
    "typescript",
  );
  if (config.includeExample) {
    files[`src/collections/Pages.${ext}`] = await formatCode(
      `/* ... Pages collection code ... */`,
      "typescript",
    );
  }

  // --- Framework Specific Files (Example for Next.js) ---
  if (config.framework === "nextjs" || !config.framework) {
    files[`src/app/layout.${ext}x`] = await formatCode(
      `/* ... RootLayout code ... */`,
      "typescript",
    );
    files[`src/app/page.${ext}x`] = await formatCode(
      `/* ... HomePage code ... */`,
      "typescript",
    );
    // Potentially add basic Payload admin route group
    files[`src/app/(payload)/admin/[[...segments]]/page.tsx`] =
      await formatCode(
        `
'use client'; // Payload admin is client-side heavy
import { NextPayloadAdmin } from '@payloadcms/next/admin'; // Adjust import based on Payload 3 final
import React from 'react';
// Import your Payload config
// import configPromise from '@payload-config'; // Assuming build step generates this

// You might need to get the config differently in Payload 3
const Page = () => {
  // return <NextPayloadAdmin config={configPromise} />;
   return <div>Payload Admin Placeholder - Check Payload 3 Next.js integration docs</div>;
};

export default Page;
`,
        "typescript",
      );

    // Simple server.ts for local dev (optional with Next.js)
    files[`src/server.${ext}`] = await formatCode(
      `/* ... basic Next.js + Payload init server.ts ... */`,
      "typescript",
    );
  } else if (config.framework === "express") {
    // Add basic Express server file structure if requested
    files[`src/server.${ext}`] = await formatCode(
      `
import express from 'express';
import payload from 'payload';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// eslint-disable-next-line
require('dotenv').config(); // Use import { config } from 'dotenv' with ESM

const filename = fileURLToPath(import.meta.url);
const Pdirname = dirname(filename);

const app = express();
const PORT = process.env.PORT || 3000; // Or read from payload config

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || '',
    express: app,
    onInit: () => {
      payload.logger.info(\`Payload Admin URL: \${payload.getAdminURL()}\`);
    },
    // Make sure ../src/payload.config.ts is used if running from dist
     config: path.resolve(Pdirname, '../src', 'payload.config.ts')
  });

  // Add your own express routes here, if needed
  // app.use('/api/custom', myCustomRouter);

  // Payload's middleware should be automatically applied by init

  app.listen(PORT, () => {
    payload.logger.info(\`Server listening on port \${PORT}\`);
  });
};

start();
`,
      "typescript",
    );
  }

  console.log(
    `MCP Core: Scaffolding generated ${Object.keys(files).length} file contents.`,
  );
  return files; // Return mapping of filenames to content
}

export async function validateScaffoldOptions(
  options: ScaffoldProjectConfig,
): Promise<{ isValid: boolean; errors: string[] }> {
  console.log(
    `MCP Core: Validating scaffold options for: ${options.projectName}`,
  );
  const errors: string[] = [];
  if (!options.projectName || !/^[a-z0-9-]+$/.test(options.projectName)) {
    errors.push(
      "Invalid project name. Use kebab-case (e.g., my-awesome-project).",
    );
  }
  if (!["mongoose", "postgres"].includes(options.dbAdapter)) {
    errors.push(
      `Invalid dbAdapter: ${options.dbAdapter}. Must be 'mongoose' or 'postgres'.`,
    );
  }
  if (options.framework && !["nextjs", "express"].includes(options.framework)) {
    errors.push(
      `Invalid framework: ${options.framework}. Supported: 'nextjs', 'express'.`,
    );
  }
  // Add more validation as needed

  return { isValid: errors.length === 0, errors };
}
