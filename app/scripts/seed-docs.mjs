/**
 * seed-docs.mjs — self-contained documentation seeder.
 *
 * The /docs hub reads its content from the PostgreSQL `docs` table. New
 * deployments start with an EMPTY table (the TypeScript seed requires a TS
 * runtime), which is why users saw a blank Documentation page.
 *
 * This script runs from the deployed image with plain `node` (same pattern as
 * ml-retrain.mjs / sync-from-supabase.mjs): it reads the markdown files baked
 * into /app/docs and upserts them by slug. Idempotent — safe to re-run.
 *
 * Env: DATABASE_URL (from task-def secrets)
 * Usage: node /app/scripts/seed-docs.mjs
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

import { readdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const DOCS_DIR = process.env.DOCS_DIR || path.join(process.cwd(), 'docs')

const FILENAME_TO_SLUG = {
  TECHNICAL: 'technical',
  CALCULATIONS: 'calculations',
  ARCHITECTURE: 'architecture',
  CHANGELOG: 'changelog',
  SCRAPER: 'scraper',
  API_REFERENCE: 'api-reference',
  DEPLOYMENT: 'deployment',
  DATA_MODEL: 'data-model',
  DATA_SOURCES: 'data-sources',
  DATA_DICTIONARY: 'data-dictionary',
  USER_GUIDE: 'user-guide',
}

const DEFAULT_CATEGORY = {
  technical: 'Technical',
  calculations: 'Technical',
  architecture: 'Technical',
  changelog: 'Meta',
  scraper: 'Technical',
  'api-reference': 'Technical',
  deployment: 'Technical',
  'data-model': 'Technical',
  'data-sources': 'Technical',
  'data-dictionary': 'Technical',
  'user-guide': 'User',
}

const DEFAULT_OWNER = {
  technical: 'Data Team',
  calculations: 'Data Team',
  architecture: 'Engineering',
  changelog: 'Release Manager',
  scraper: 'Data Team',
  'api-reference': 'Engineering',
  deployment: 'DevOps',
  'data-model': 'Data Team',
  'data-sources': 'Data Team',
  'data-dictionary': 'Data Team',
  'user-guide': 'Product',
}

const DEFAULT_ORDER = {
  architecture: 10,
  'data-model': 20,
  'data-sources': 30,
  'data-dictionary': 40,
  calculations: 50,
  scraper: 60,
  'api-reference': 70,
  deployment: 80,
  technical: 90,
  'user-guide': 100,
  changelog: 110,
}

function parseDoc(filename, raw) {
  const base = filename.replace(/\.md$/, '')
  const slug = FILENAME_TO_SLUG[base] || base.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const lines = raw.split('\n')
  let title = null
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) { title = m[1].trim(); break }
  }
  if (!title) title = base.replace(/_/g, ' ')
  // strip optional front-matter style metadata
  let content = raw
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)
  let category = DEFAULT_CATEGORY[slug] || 'General'
  let owner = DEFAULT_OWNER[slug] || 'Data Team'
  if (fm) {
    content = raw.slice(fm[0].length)
    const catM = fm[1].match(/^category:\s*(.+)$/m)
    if (catM) category = catM[1].trim()
    const ownM = fm[1].match(/^owner:\s*(.+)$/m)
    if (ownM) owner = ownM[1].trim()
  }
  return {
    slug,
    title,
    category,
    content: content.trim(),
    order: DEFAULT_ORDER[slug] ?? 100,
    owner,
  }
}

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    if (!existsSync(DOCS_DIR)) {
      console.error('[seed-docs] docs dir not found:', DOCS_DIR)
      process.exit(1)
    }
    const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'))
    console.log(`[seed-docs] found ${files.length} markdown files in ${DOCS_DIR}`)
    let upserted = 0
    for (const f of files) {
      const raw = readFileSync(path.join(DOCS_DIR, f), 'utf-8')
      const doc = parseDoc(f, raw)
      await prisma.doc.upsert({
        where: { slug: doc.slug },
        create: {
          slug: doc.slug,
          title: doc.title,
          category: doc.category,
          order: doc.order,
          content: doc.content,
          owner: doc.owner,
          is_published: true,
          last_updated: new Date(),
        },
        update: {
          title: doc.title,
          category: doc.category,
          order: doc.order,
          content: doc.content,
          owner: doc.owner,
          is_published: true,
          last_updated: new Date(),
        },
      })
      upserted += 1
      console.log(`[seed-docs] upserted: ${doc.slug} (${doc.title})`)
    }
    console.log(`[seed-docs] DONE — ${upserted}/${files.length} docs upserted`)
    await prisma.$disconnect()
    process.exit(0)
  } catch (e) {
    console.error('[seed-docs] FAILED:', e?.message || e)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

main()
