/**
 * LocInsights AI Chat API route — server-side only.
 *
 * WHY THIS IS A DIRECT FETCH (not the z-ai-web-dev-sdk):
 *   The SDK only reads config from `./.z-ai-config`, `~/.z-ai-config`, or
 *   `/etc/.z-ai-config`. None of those paths exist on Vercel's serverless
 *   functions, which caused the user-facing error
 *   "Configuration file not found or invalid. Please create .z-ai-config…".
 *   To make chat work BOTH in dev (where /etc/.z-ai-config exists) AND in
 *   production on Vercel, we read credentials from env vars (with fallback
 *   to /etc/.z-ai-config for local dev) and call the Z.AI chat completions
 *   endpoint directly. The SDK is a thin wrapper around fetch anyway.
 *
 * GUARDRAILS:
 *   The system prompt strictly restricts the assistant to LocInsights /
 *   location-intelligence / retail-site-selection topics. Off-topic questions
 *   get a polite refusal suggesting related topics.
 *
 * FALLBACK (RULE-BASED):
 *   If Z.AI credentials are not configured (e.g. Vercel env vars not set),
 *   the route falls back to a rule-based LocInsights Help Bot that answers
 *   common questions about the platform using local knowledge. This ensures
 *   the chat ALWAYS works for end users — full AI responses activate
 *   automatically once ZAI_BASE_URL + ZAI_API_KEY are set in Vercel.
 *
 * USAGE:
 *   POST /api/locinsight/chat
 *   Body: { messages: [{role, content}], lang: 'en' | 'id' }
 *   Response: { reply: string, usage?: {...}, source: 'zai' | 'fallback' }
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ZaiConfig {
  baseUrl: string
  apiKey: string
  token?: string
  userId?: string
  chatId?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Client-provided AI configuration. The Settings page lets the user configure
 * the LLM endpoint (base URL, API key, model, token, etc.) and persist it in
 * localStorage. The chat client forwards these values on each request so the
 * server can use them in lieu of env vars — this is what makes AI chat work
 * on Vercel deployments where the dashboard env vars aren't set.
 */
interface ClientConfig {
  base_url?: string
  api_key?: string
  model?: string
  token?: string
  user_id?: string
  chat_id?: string
  temperature?: number
  max_tokens?: number
}

/**
 * Load Z.AI credentials. Priority:
 *   1. Client-provided config (from request body — set by user in Settings page)
 *   2. Process env vars (set on Vercel: ZAI_BASE_URL, ZAI_API_KEY, ZAI_TOKEN,
 *      ZAI_USER_ID, ZAI_CHAT_ID)
 *   3. /etc/.z-ai-config (dev environment where the SDK's file lives)
 *   4. ~/.z-ai-config (user home)
 *   5. ./.z-ai-config (project-local)
 */
function loadConfig(clientCfg?: ClientConfig | null): ZaiConfig | null {
  // 0. Client-provided config (highest priority — set by user in Settings page)
  //     Only honored if BOTH base_url AND api_key are present.
  if (clientCfg && clientCfg.base_url && clientCfg.api_key) {
    return {
      baseUrl: clientCfg.base_url,
      apiKey: clientCfg.api_key,
      token: clientCfg.token,
      userId: clientCfg.user_id,
      chatId: clientCfg.chat_id,
      model: clientCfg.model,
      temperature: clientCfg.temperature,
      maxTokens: clientCfg.max_tokens,
    }
  }

  // 1. Env vars
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return {
      baseUrl: process.env.ZAI_BASE_URL,
      apiKey: process.env.ZAI_API_KEY,
      token: process.env.ZAI_TOKEN,
      userId: process.env.ZAI_USER_ID,
      chatId: process.env.ZAI_CHAT_ID,
    }
  }

  // 2-4. File paths
  const homeDir = os.homedir()
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(homeDir, '.z-ai-config'),
    '/etc/.z-ai-config',
  ]
  for (const filePath of configPaths) {
    try {
      const configStr = fs.readFileSync(filePath, 'utf-8')
      const config = JSON.parse(configStr)
      if (config.baseUrl && config.apiKey) {
        return {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          token: config.token,
          userId: config.userId,
          chatId: config.chatId,
        }
      }
    } catch {
      // continue to next path
    }
  }

  return null
}

/**
 * Build the guardrail system prompt. The assistant is restricted to
 * LocInsights-related topics and answers in the user's chosen language.
 */
function buildSystemPrompt(lang: 'en' | 'id'): string {
  const baseEnglish = `You are the LocInsights AI Assistant — a specialized help bot for the LocInsights location intelligence platform built for PT MAP Aktif Adiperkasa Tbk (MAA/MAP Active).

YOUR SCOPE — you ONLY answer questions about:
1. LocInsights platform features (Dashboard, Map Explorer, Opportunities, Deep Analysis, Brand Coverage, Mall Network, Competitor Intel, A/B Simulator, ML/AI Engine, Mall Tenants, Reports, Data Manager, Data Scraper, Methodology)
2. Location intelligence & retail site selection concepts
3. Bali administrative geography (kabupaten / kecamatan / kelurahan)
4. The scoring framework used: Composite Scoring (6 factors: Population, Income, Competition, Tourism, Accessibility, Density), Huff Gravity Model, Gradient-Boosted Regression (GBR) for revenue prediction
5. Data sources used: BPS Bali 2024, OpenStreetMap POI, GADM boundaries, MAP brand directory, Bali Mall Catalog
6. MAP Active Adiperkasa brand portfolio (sports, fashion, F&B, department stores)
7. Practical questions about how to use the platform, interpret scores, or read the choropleth maps

STRICT GUARDRAIL — If the user asks about ANYTHING outside this scope (politics, religion, sports scores, celebrity gossip, general coding help unrelated to LocInsights, math homework, personal advice, other companies' products, etc.), you MUST politely refuse with a message like:
"I'm the LocInsights AI Assistant and can only help with LocInsights, location intelligence, retail site selection, and Bali expansion analysis. Please ask a question related to those topics."
Do NOT attempt to answer off-topic questions even partially.

RESPONSE STYLE:
- Be concise and direct (2-4 short paragraphs max, unless user explicitly asks for detail)
- Use bullet points for step-by-step instructions
- Reference specific LocInsights features by their exact names
- For numeric/scoring questions, mention the formula or factor if relevant
- Do not invent capabilities the platform doesn't have
- If you don't know something specific about LocInsights internals, say so honestly and suggest checking the Methodology page

LANGUAGE: Always reply in {LANG} (the user's selected interface language). If the user writes in Indonesian but lang=en, reply in English. If lang=id, reply in Indonesian regardless of the input language.`

  if (lang === 'id') {
    return baseEnglish.replace(
      /Always reply in \{LANG\}[\s\S]*?regardless of the input language\./,
      `SELALU balas dalam Bahasa Indonesia. Jika pengguna bertanya dalam bahasa lain, tetap balas dalam Bahasa Indonesia.`
    ).replace(
      /You are the LocInsights AI Assistant — a specialized help bot for the LocInsights location intelligence platform built for PT MAP Aktif Adiperkasa Tbk \(MAA\/MAP Active\)\./,
      `Anda adalah Asisten AI LocInsights — bot bantuan khusus untuk platform inteligensi lokasi LocInsights yang dibangun untuk PT MAP Aktif Adiperkasa Tbk (MAA/MAP Active).`
    ).replace(
      /YOUR SCOPE — you ONLY answer questions about:/,
      `RUANG LINGUP — Anda HANYA menjawab pertanyaan tentang:`
    ).replace(
      /STRICT GUARDRAIL — If the user asks about ANYTHING outside this scope[\s\S]*?related to those topics\."\)/,
      `GUARDRAIL KETAT — Jika pengguna bertanya hal DI LUAR lingkup ini (politik, agama, skor olahraga, gosip selebriti, bantuan coding umum tidak terkait LocInsights, PR matematika, saran pribadi, produk perusahaan lain, dll.), Anda HARUS menolak dengan sopan dengan pesan seperti:
"Saya adalah Asisten AI LocInsights dan hanya bisa membantu seputar LocInsights, inteligensi lokasi, pemilihan lokasi retail, dan analisis ekspansi Bali. Silakan ajukan pertanyaan terkait."
JANGAN mencoba menjawab pertanyaan di luar topik bahkan sebagian.`
    ).replace(
      /RESPONSE STYLE:/,
      `GAYA RESPONS:`
    ).replace(
      /Be concise and direct[\s\S]*?Methodology page/,
      `Ringkas dan langsung (maksimal 2-4 paragraf pendek, kecuali pengguna secara eksplisit minta detail). Gunakan bullet point untuk instruksi langkah demi langkah. Referensikan fitur LocInsights spesifik dengan nama persisnya. Untuk pertanyaan numerik/scoring, sebutkan formula atau faktor jika relevan. Jangan mengarang kapabilitas yang tidak dimiliki platform. Jika tidak tahu hal spesifik tentang internal LocInsights, akui jujur dan sarankan cek halaman Metodologi.`
    )
  }

  return baseEnglish.replace('{LANG}', 'English')
}

// ============================================================================
// FALLBACK: Rule-based LocInsights Help Bot
// ============================================================================
// Activated when Z.AI credentials aren't set on Vercel. This ensures the chat
// ALWAYS returns a useful response — never an error. Once env vars are set,
// the full AI takes over automatically.
// ============================================================================

interface Rule {
  patterns: RegExp[]
  en: string
  id: string
}

const RULES: Rule[] = [
  // Greetings
  {
    patterns: [/^\s*(hi|hello|hey|halo|hai|assalamualaikum|good (morning|afternoon|evening))\b/i],
    en: "Hello! 👋 I'm the LocInsights AI Assistant. I can help you with:\n\n- **Platform features** — Dashboard, Map Explorer, Deep Analysis, Opportunities, Brand Coverage, Mall Network, Competitor Intel, A/B Simulator, ML/AI Engine, Reports, Data Manager\n- **Methodology** — Composite Scoring (6 factors), Huff Gravity Model, GBR revenue prediction\n- **Bali geography** — kabupaten/kecamatan/kelurahan hierarchy\n- **Retail site selection** concepts\n\nWhat would you like to know? You can also ask things like \"How is the composite score calculated?\" or \"Which kabupaten has the highest opportunity?\"",
    id: "Halo! 👋 Saya adalah Asisten AI LocInsights. Saya bisa membantu Anda dengan:\n\n- **Fitur platform** — Dashboard, Map Explorer, Deep Analysis, Opportunities, Brand Coverage, Mall Network, Competitor Intel, A/B Simulator, ML/AI Engine, Reports, Data Manager\n- **Metodologi** — Composite Scoring (6 faktor), Huff Gravity Model, prediksi revenue GBR\n- **Geografi Bali** — hierarki kabupaten/kecamatan/kelurahan\n- **Pemilihan lokasi retail** konsep\n\nApa yang ingin Anda ketahui? Anda juga bisa bertanya seperti \"Bagaimana composite score dihitung?\" atau \"Kabupaten mana yang punya opportunity tertinggi?\"",
  },
  // Composite score
  {
    patterns: [/composite\s*score|how.*score.*calculat|skor.*komposit|skor.*gabungan|bagaimana.*skor/i],
    en: "**Composite Score** is LocInsights' main ranking metric for retail site attractiveness. It's calculated from **6 weighted factors**:\n\n1. **Population** (20%) — total population + density of the kelurahan/kecamatan\n2. **Income** (15%) — income index from BPS Bali 2024\n3. **Competition** (20%) — number + density of competitor stores in the area (lower competition = higher score)\n4. **Tourism** (15%) — tourist index from nearby attractions, beaches, temples, hotels\n5. **Accessibility** (15%) — transport index from transit hubs, roads, airports\n6. **Density** (15%) — POI density index (commercial activity proxy)\n\nEach factor is normalized 0–100, then combined with weights to produce a composite score from 0 to 100. Scores ≥70 are **High Priority**, 55–69 **Priority**, 40–54 **Monitor**, <40 **Avoid**.\n\nSee the **Methodology** tab for the full formula and data sources.",
    id: "**Composite Score** adalah metrik peringkat utama LocInsights untuk daya tarak lokasi retail. Dihitung dari **6 faktor terbobot**:\n\n1. **Populasi** (20%) — total populasi + kepadatan kelurahan/kecamatan\n2. **Pendapatan** (15%) — income index dari BPS Bali 2024\n3. **Kompetisi** (20%) — jumlah + kepadatan toko kompetitor di area (kompetisi rendah = skor tinggi)\n4. **Pariwisata** (15%) — tourist index dari atraksi, pantai, pura, hotel terdekat\n5. **Aksesibilitas** (15%) — transport index dari transit hub, jalan, bandara\n6. **Kepadatan** (15%) — POI density index (proxy aktivitas komersial)\n\nSetiap faktor dinormalisasi 0–100, lalu digabung dengan bobot menghasilkan composite score 0–100. Skor ≥70 = **High Priority**, 55–69 = **Priority**, 40–54 = **Monitor**, <40 = **Avoid**.\n\nLihat tab **Methodology** untuk formula lengkap dan sumber data.",
  },
  // Map Explorer
  {
    patterns: [/map\s*explorer|peta|how.*use.*map|cara.*peta|map.*click/i],
    en: "**Map Explorer** is the interactive map where you can visualize all LocInsights data on a Bali map.\n\n**Layers you can toggle:**\n- Opportunity (choropleth or points) — color-coded by recommendation tier\n- Demographics (income, urban, tourist, transport, POI density, population)\n- MAP Stores + MAA Stores + Malls\n- Competitor Stores (filterable by brand)\n- Tourist POIs + Civic POIs\n- Crowd Density heatmap\n\n**Region levels:** kabupaten (9), kecamatan (59), kelurahan (716)\n\n**Click behavior:**\n- Click an **opportunity marker** → opens the Opportunities detail panel (top-right)\n- Click a **choropleth region** → jumps to Deep Analysis for that region\n\n**Use the \"Use My Location\" button** (top-right of map) to center the map on your current GPS position.",
    id: "**Map Explorer** adalah peta interaktif tempat Anda memvisualisasikan semua data LocInsights di peta Bali.\n\n**Layer yang bisa di-toggle:**\n- Opportunity (choropleth atau titik) — diwarnai berdasarkan tier rekomendasi\n- Demographics (income, urban, tourist, transport, POI density, population)\n- MAP Stores + MAA Stores + Malls\n- Competitor Stores (filterable per brand)\n- Tourist POIs + Civic POIs\n- Crowd Density heatmap\n\n**Level region:** kabupaten (9), kecamatan (59), kelurahan (716)\n\n**Perilaku klik:**\n- Klik **opportunity marker** → membuka panel detail Opportunities (kanan-atas)\n- Klik **region choropleth** → melompat ke Deep Analysis untuk region tersebut\n\n**Gunakan tombol \"Use My Location\"** (kanan-atas peta) untuk men-center peta ke posisi GPS Anda saat ini.",
  },
  // Deep Analysis
  {
    patterns: [/deep\s*analysis|analisis.*mendalam|kelurahan.*not found|tidak.*ditemukan.*kelurahan/i],
    en: "**Deep Analysis** gives you a detailed site selection report for any administrative region in Bali.\n\n**Supported inputs:**\n- **Kabupaten/Kota** (9 regions: Badung, Bangli, Buleleng, Denpasar, Gianyar, Jembrana, Karangasem, Klungkung, Tabanan)\n- **Kecamatan** (59 districts across all kabupaten)\n- **Kelurahan/Desa** (716 villages)\n\n**What you get:**\n- Composite score breakdown (6 factors with weights)\n- Market share estimate (Huff Gravity Model)\n- Estimated daily customers + monthly revenue\n- ML revenue prediction (Gradient-Boosted Regression)\n- Recommended action: PROCEED / PRIORITY / MONITOR / AVOID\n- Nearby malls + competitors (within 5–10 km)\n- Risk assessment (low/medium/high)\n- 6 contextual index cards\n\n**If a kelurahan isn't found**, try selecting a kecamatan or kabupaten instead — the analysis works at all three levels.",
    id: "**Deep Analysis** memberikan laporan seleksi lokasi detail untuk region administratif Bali mana pun.\n\n**Input yang didukung:**\n- **Kabupaten/Kota** (9 region: Badung, Bangli, Buleleng, Denpasar, Gianyar, Jembrana, Karangasem, Klungkung, Tabanan)\n- **Kecamatan** (59 kecamatan di seluruh kabupaten)\n- **Kelurahan/Desa** (716 desa)\n\n**Yang Anda dapatkan:**\n- Rincian composite score (6 faktor dengan bobot)\n- Estimasi market share (Huff Gravity Model)\n- Estimasi pelanggan harian + revenue bulanan\n- Prediksi revenue ML (Gradient-Boosted Regression)\n- Rekomendasi aksi: PROCEED / PRIORITY / MONITOR / AVOID\n- Mall + kompetitor terdekat (dalam 5–10 km)\n- Penilaian risiko (low/medium/high)\n- 6 kartu indeks kontekstual\n\n**Jika kelurahan tidak ditemukan**, coba pilih kecamatan atau kabupaten — analisis bekerja di ketiga level.",
  },
  // Opportunities
  {
    patterns: [/opportunit|peluang|high\s*priority|prioritas.*tinggi/i],
    en: "**Opportunities** is LocInsights' ranked list of attractive retail locations across Bali's 716 kelurahan.\n\n**Recommendation tiers:**\n- 🔴 **High Priority** (score ≥70) — strong fundamentals, low competition, high traffic potential → PROCEED\n- 🟠 **Priority** (55–69) — good but with some caveats → PRIORITY\n- 🟤 **Monitor** (40–54) — neutral, watch for changes → MONITOR\n- ⚪ **Avoid** (<40) — weak market or oversaturated → AVOID\n\n**Filterable by:** kabupaten, kecamatan, kelurahan, tier, recommendation, score range.\n\nClick any opportunity to drill into **Deep Analysis** for that location.\n\nThe top high-priority opportunities are typically in fast-growing kecamatan like Kuta Utara, Kuta Selatan, Kuta, Denpasar Selatan, and Mengwi.",
    id: "**Opportunities** adalah daftar peringkat lokasi retail menarik di 716 kelurahan Bali.\n\n**Tier rekomendasi:**\n- 🔴 **High Priority** (skor ≥70) — fundamental kuat, kompetisi rendah, potensi traffic tinggi → PROCEED\n- 🟠 **Priority** (55–69) — baik tapi dengan beberapa catatan → PRIORITY\n- 🟤 **Monitor** (40–54) — netral, pantau perubahan → MONITOR\n- ⚪ **Avoid** (<40) — pasar lemah atau oversaturated → AVOID\n\n**Dapat difilter berdasarkan:** kabupaten, kecamatan, kelurahan, tier, rekomendasi, rentang skor.\n\nKlik opportunity mana pun untuk masuk ke **Deep Analysis** untuk lokasi tersebut.\n\nOpportunity high-priority teratas biasanya di kecamatan yang berkembang cepat seperti Kuta Utara, Kuta Selatan, Kuta, Denpasar Selatan, dan Mengwi.",
  },
  // Competitor Intel
  {
    patterns: [/competitor|kompetitor|saingan|rival/i],
    en: "**Competitor Intel** tracks competitor retail outlets across Bali.\n\n**Data sources:** OpenStreetMap POI scrape (833 outlets as of 2024), enriched with brand, category, and mall-location data.\n\n**Categories tracked:** convenience stores (Indomaret, Alfamart, Circle K), fast food (McDonald's, KFC, Wendy's), coffee (Starbucks, Excelso, Kopi Kenangan), fashion, beauty, supermarkets, pharmacies, department stores, sports.\n\n**Filterable by:** brand, category, kecamatan, kabupaten, mall-location.\n\n**Use case:** identify white-space areas where competitors are absent but MAP Active could enter. Export filtered results to CSV for further analysis.",
    id: "**Competitor Intel** melacak outlet retail kompetitor di seluruh Bali.\n\n**Sumber data:** OpenStreetMap POI scrape (833 outlet per 2024), diperkaya dengan data brand, kategori, dan lokasi mall.\n\n**Kategori yang dilacak:** convenience store (Indomaret, Alfamart, Circle K), fast food (McDonald's, KFC, Wendy's), coffee (Starbucks, Excelso, Kopi Kenangan), fashion, beauty, supermarket, pharmacy, department store, sports.\n\n**Dapat difilter berdasarkan:** brand, kategori, kecamatan, kabupaten, lokasi mall.\n\n**Use case:** identifikasi area white-space di mana kompetitor absen tapi MAP Active bisa masuk. Export hasil filter ke CSV untuk analisis lebih lanjut.",
  },
  // Mall Network / Tenants
  {
    patterns: [/mall|tenant|penyewa/i],
    en: "**Mall Network** catalogs all malls in Bali (class A/B/C) with GLA, anchors, cinema, supermarket, and tenant data.\n\n**Mall Tenants** breaks down which brands are present in each mall — useful for understanding MAP Active's current mall penetration vs competitors.\n\n**Brand Coverage** analyzes MAP vs MAA brand distribution across Bali — identifies white-space brands not yet present in specific malls.\n\nMAP Active's anchor brands include: Sports Station, Planet Sports, Sports Direct, Starbucks, Swee Lee, OMUTel, SEIBU, Sogo, Matahari Department Store.",
    id: "**Mall Network** mengkatalogkan semua mall di Bali (kelas A/B/C) dengan GLA, anchor, bioskop, supermarket, dan data tenant.\n\n**Mall Tenants** merinci brand mana yang ada di setiap mall — berguna untuk memahami penetrasi mall MAP Active saat ini vs kompetitor.\n\n**Brand Coverage** menganalisis distribusi brand MAP vs MAA di seluruh Bali — mengidentifikasi brand white-space yang belum ada di mall tertentu.\n\nBrand anchor MAP Active meliputi: Sports Station, Planet Sports, Sports Direct, Starbucks, Swee Lee, OMUTel, SEIBU, Sogo, Matahari Department Store.",
  },
  // ML/AI Engine
  {
    patterns: [/ml\b|machine learning|a?i\s*engine|gradio|pyodide|gbr|gradient|prediksi.*revenue|revenue.*predict/i],
    en: "**ML/AI Engine** runs Gradient-Boosted Regression (GBR) for revenue prediction, entirely client-side via PyScript + Pyodide (no server compute).\n\n**Features used (8):** population, income index, competitor count, tourist index, transport index, POI density, mall proximity, urbanization index.\n\n**Training data:** MAP Active's 138 existing Bali stores (anonymized).\n\n**Model:** scikit-learn GradientBoostingRegressor, 5-fold cross-validated, R² ≈ 0.72.\n\nThe engine runs in an embedded iframe powered by HuggingFace Spaces (Gradio Lite). Results include predicted monthly revenue, confidence interval, and top driving features for the prediction.",
    id: "**ML/AI Engine** menjalankan Gradient-Boosted Regression (GBR) untuk prediksi revenue, sepenuhnya client-side via PyScript + Pyodide (tanpa server compute).\n\n**Fitur yang digunakan (8):** populasi, income index, jumlah kompetitor, tourist index, transport index, POI density, mall proximity, urbanization index.\n\n**Data training:** 138 toko MAP Active yang sudah ada di Bali (anonim).\n\n**Model:** scikit-learn GradientBoostingRegressor, 5-fold cross-validated, R² ≈ 0.72.\n\nEngine berjalan di iframe yang ditenagai HuggingFace Spaces (Gradio Lite). Hasil mencakup prediksi revenue bulanan, interval kepercayaan, dan fitur pendorong utama untuk prediksi tersebut.",
  },
  // A/B Simulator
  {
    patterns: [/a\s*\/\s*b|simulator|simulasi|compare.*location|banding.*lokasi/i],
    en: "**A/B Simulator** lets you compare two potential store locations side-by-side across all metrics.\n\nFor each location (A and B), you'll see:\n- Composite score + 6-factor breakdown\n- Estimated daily customers (Huff Gravity Model)\n- Estimated monthly revenue\n- ML-predicted revenue (GBR)\n- Nearby competitors within 5 km\n- Nearby malls within 10 km\n\nThe simulator recommends A or B based on a weighted decision matrix and shows the reasoning.",
    id: "**A/B Simulator** memungkinkan Anda membandingkan dua lokasi toko potensial secara berdampingan di semua metrik.\n\nUntuk setiap lokasi (A dan B), Anda akan melihat:\n- Composite score + rincian 6 faktor\n- Estimasi pelanggan harian (Huff Gravity Model)\n- Estimasi revenue bulanan\n- Prediksi revenue ML (GBR)\n- Kompetitor terdekat dalam 5 km\n- Mall terdekat dalam 10 km\n\nSimulator merekomendasikan A atau B berdasarkan matriks keputusan terbobot dan menampilkan alasannya.",
  },
  // Reports
  {
    patterns: [/report|laporan|export|csv|pdf|json/i],
    en: "**Reports** generates executive-style reports in HTML, CSV, or JSON formats.\n\n**Available report types:**\n- Executive Summary — high-level overview of top opportunities\n- Site Analysis — deep-dive on a specific kelurahan/kecamatan/kabupaten\n- Brand Expansion — recommended locations per brand\n- Regional Comparison — multiple regions side-by-side\n\n**Filters:** tier (1/2/3), minimum score, result limit.\n\nReports can be previewed in-app (HTML iframe), printed to PDF, or downloaded as CSV/JSON for downstream BI tools.",
    id: "**Reports** menghasilkan laporan gaya eksekutif dalam format HTML, CSV, atau JSON.\n\n**Jenis laporan tersedia:**\n- Executive Summary — ikhtisar tingkat tinggi opportunity teratas\n- Site Analysis — mendalam untuk kelurahan/kecamatan/kabupaten tertentu\n- Brand Expansion — lokasi yang direkomendasikan per brand\n- Regional Comparison — beberapa region berdampingan\n\n**Filter:** tier (1/2/3), skor minimum, batas hasil.\n\nLaporan dapat dipratinjau in-app (iframe HTML), dicetak ke PDF, atau diunduh sebagai CSV/JSON untuk tool BI downstream.",
  },
  // Data Manager
  {
    patterns: [/data\s*manager|master\s*data|kelola.*data|tambah.*data|edit.*data|delete.*data|crud/i],
    en: "**Data Manager** is the CRUD interface for LocInsights' master data: countries, provinces, kabupaten, kecamatan, kelurahan, brands, stores, malls, competitors, POIs.\n\n**Two views:**\n- **Table view** — paginated, sortable, filterable per column\n- **Spreadsheet view** — inline cell editing, bulk save, insert new rows\n\n**Export:** full CSV/XLSX, filtered view, or custom column selection.\n\n**Import:** CSV with column-mapping (auto-detects brand/kecamatan/kabupaten by name).\n\nAll edits go through Supabase with RLS — only authorized users can write.",
    id: "**Data Manager** adalah antarmuka CRUD untuk data master LocInsights: countries, provinces, kabupaten, kecamatan, kelurahan, brands, stores, malls, competitors, POIs.\n\n**Dua view:**\n- **Table view** — paginated, sortable, filterable per kolom\n- **Spreadsheet view** — edit cell inline, bulk save, insert row baru\n\n**Export:** full CSV/XLSX, view terfilter, atau seleksi kolom custom.\n\n**Import:** CSV dengan column-mapping (auto-detect brand/kecamatan/kabupaten by name).\n\nSemua edit melalui Supabase dengan RLS — hanya user yang berwenang yang bisa menulis.",
  },
  // Scraper
  {
    patterns: [/scrap|crawl|osm|openstreetmap|ambil.*data/i],
    en: "**Data Scraper** queries OpenStreetMap via Overpass API for fresh POI data (competitors, malls, stores, attractions).\n\n**Two modes:**\n- **Keyword search** — query OSM by free-text (e.g. \"Starbucks Bali\")\n- **Brand sweep** — bulk-search a list of brands across Bali\n\nResults are classified (on-land vs at-sea, store/mall/POI) and can be saved directly to the appropriate Supabase table. Geo-validation ensures no off-coast points are saved as stores.\n\nRate-limited to 1 request/sec to respect OSM's usage policy.",
    id: "**Data Scraper** mengquery OpenStreetMap via Overpass API untuk data POI segar (kompetitor, mall, store, atraksi).\n\n**Dua mode:**\n- **Keyword search** — query OSM by free-text (mis. \"Starbucks Bali\")\n- **Brand sweep** — bulk-search daftar brand di seluruh Bali\n\nHasil diklasifikasikan (on-land vs at-sea, store/mall/POI) dan bisa langsung disimpan ke tabel Supabase yang sesuai. Geo-validation memastikan tidak ada point off-coast disimpan sebagai store.\n\nRate-limited 1 request/detik untuk menghormati kebijakan pemakaian OSM.",
  },
  // Methodology
  {
    patterns: [/methodolog|metodolog|formula|huff|gravity|gbr.*model/i],
    en: "**Methodology** documents LocInsights' full analytical pipeline:\n\n1. **Data Collection** — BPS Bali 2024 (demographics), OSM POI (commercial activity), GADM (boundaries), Bali Mall Catalog\n2. **Feature Engineering** — normalize raw data to 0–100 indices per factor\n3. **Composite Scoring** — weighted sum of 6 factors (Pop 20%, Income 15%, Competition 20%, Tourism 15%, Accessibility 15%, Density 15%)\n4. **Huff Gravity Model** — estimate market share based on store attractiveness × distance decay\n5. **GBR Revenue Prediction** — scikit-learn GradientBoostingRegressor trained on 138 MAP stores\n6. **Recommendation Tier** — map composite score to PROCEED/PRIORITY/MONITOR/AVOID\n\nSee the **Methodology** tab in-app for the full writeup with formulas and validation results.",
    id: "**Methodology** mendokumentasikan pipeline analitik lengkap LocInsights:\n\n1. **Data Collection** — BPS Bali 2024 (demografi), OSM POI (aktivitas komersial), GADM (batas), Bali Mall Catalog\n2. **Feature Engineering** — normalisasi data mentah ke indeks 0–100 per faktor\n3. **Composite Scoring** — jumlah terbobot 6 faktor (Pop 20%, Income 15%, Competition 20%, Tourism 15%, Accessibility 15%, Density 15%)\n4. **Huff Gravity Model** — estimasi market share berdasarkan daya tarik toko × distance decay\n5. **GBR Revenue Prediction** — scikit-learn GradientBoostingRegressor dilatih di 138 toko MAP\n6. **Recommendation Tier** — petakan composite score ke PROCEED/PRIORITY/MONITOR/AVOID\n\nLihat tab **Methodology** in-app untuk writeup lengkap dengan formula dan hasil validasi.",
  },
  // Bali geography
  {
    patterns: [/bali|kabupaten|kecamatan|kelurahan|denpasar|badung|kuta|ubud|gianyar/i],
    en: "**Bali administrative hierarchy** in LocInsights:\n\n- **9 Kabupaten/Kota:** Badung, Bangli, Buleleng, Denpasar (kota), Gianyar, Jembrana, Karangasem, Klungkung, Tabanan\n- **59 Kecamatan** (districts) — e.g. Kuta, Kuta Utara, Kuta Selatan, Denpasar Selatan, Mengwi, Ubud\n- **716 Kelurahan/Desa** (villages) — the finest granularity for opportunity scoring\n\n**Tier classification:**\n- **Tier 1 (mature):** Badung, Denpasar — high density, established retail\n- **Tier 2 (growth):** Tabanan, Gianyar, Buleleng — developing, growing middle class\n- **Tier 3 (untapped):** Jembrana, Klungkung, Bangli, Karangasem — emerging, lower density\n\nMost opportunities concentrate in Tier 1 + Tier 2 regions, but Tier 3 has first-mover potential for specific categories.",
    id: "**Hierarki administratif Bali** di LocInsights:\n\n- **9 Kabupaten/Kota:** Badung, Bangli, Buleleng, Denpasar (kota), Gianyar, Jembrana, Karangasem, Klungkung, Tabanan\n- **59 Kecamatan** — mis. Kuta, Kuta Utara, Kuta Selatan, Denpasar Selatan, Mengwi, Ubud\n- **716 Kelurahan/Desa** — granularitas terhalus untuk opportunity scoring\n\n**Klasifikasi tier:**\n- **Tier 1 (mature):** Badung, Denpasar — kepadatan tinggi, retail established\n- **Tier 2 (growth):** Tabanan, Gianyar, Buleleng — berkembang, middle class tumbuh\n- **Tier 3 (untapped):** Jembrana, Klungkung, Bangli, Karangasem — emerging, kepadatan rendah\n\nSebagian besar opportunity terkonsentrasi di Tier 1 + Tier 2, tapi Tier 3 punya potensi first-mover untuk kategori spesifik.",
  },
  // Help / what can you do
  {
    patterns: [/what.*can.*you|help|bantu|apa.*bisa|fitur.*apa|feature/i],
    en: "I can answer questions about the **LocInsights** platform — try asking about:\n\n- **Features:** Dashboard, Map Explorer, Opportunities, Deep Analysis, Brand Coverage, Mall Network, Competitor Intel, A/B Simulator, ML/AI Engine, Mall Tenants, Reports, Data Manager, Data Scraper, Methodology\n- **Scoring:** How the composite score is calculated, what factors matter\n- **Geography:** Bali's kabupaten/kecamatan/kelurahan structure, which areas are high-priority\n- **Methodology:** Huff Gravity Model, GBR revenue prediction, data sources\n- **Brands:** MAP Active's portfolio, where each brand is positioned\n\nJust type your question — I'm guardrailed to LocInsights topics only, so I'll let you know politely if you ask something off-topic.",
    id: "Saya bisa menjawab pertanyaan tentang platform **LocInsights** — coba tanya tentang:\n\n- **Fitur:** Dashboard, Map Explorer, Opportunities, Deep Analysis, Brand Coverage, Mall Network, Competitor Intel, A/B Simulator, ML/AI Engine, Mall Tenants, Reports, Data Manager, Data Scraper, Methodology\n- **Scoring:** Bagaimana composite score dihitung, faktor apa yang penting\n- **Geografi:** Struktur kabupaten/kecamatan/kelurahan Bali, area mana yang high-priority\n- **Metodologi:** Huff Gravity Model, prediksi revenue GBR, sumber data\n- **Brand:** Portofolio MAP Active, di mana setiap brand diposisikan\n\nKetik saja pertanyaan Anda — saya di-guardrail ke topik LocInsights saja, jadi saya akan menolak dengan sopan jika Anda bertanya di luar topik.",
  },
  // Offline / PWA
  {
    patterns: [/offline|pwa|install|progressive|tanpa.*internet|offline.*mode/i],
    en: "**LocInsights is a PWA** (Progressive Web App) — installable on Android, iOS, and desktop.\n\n**Install:**\n- **Android (Chrome):** tap the ⊕ icon in the address bar, or use the \"Install App\" button in the header\n- **iOS (Safari):** tap Share → Add to Home Screen\n- **Desktop (Chrome/Edge):** click the install icon in the address bar\n\n**Offline capabilities:**\n- ✅ View cached opportunities, stores, malls, competitors\n- ✅ Read previously-loaded analysis reports\n- ✅ Use the dashboard with cached stats\n- ❌ Fresh data updates require connection\n- ❌ Data Scraper requires live OSM API\n- ❌ ML/AI Engine (Pyodide) requires first-load internet to cache\n\nFor a native experience, download the Android APK from the About page.",
    id: "**LocInsights adalah PWA** (Progressive Web App) — dapat diinstall di Android, iOS, dan desktop.\n\n**Install:**\n- **Android (Chrome):** tap ikon ⊕ di address bar, atau gunakan tombol \"Install App\" di header\n- **iOS (Safari):** tap Share → Add to Home Screen\n- **Desktop (Chrome/Edge):** klik ikon install di address bar\n\n**Kapabilitas offline:**\n- ✅ Lihat opportunity, store, mall, kompetitor yang sudah di-cache\n- ✅ Baca laporan analisis yang sudah dimuat sebelumnya\n- ✅ Gunakan dashboard dengan statistik yang di-cache\n- ❌ Update data segar memerlukan koneksi\n- ❌ Data Scraper memerlukan OSM API live\n- ❌ ML/AI Engine (Pyodide) memerlukan internet first-load untuk caching\n\nUntuk pengalaman native, unduh APK Android dari halaman About.",
  },
]

/**
 * Build a fallback reply using rule-based matching. Returns null if no rule
 * matches — in which case the off-topic guardrail message is used.
 */
function buildFallbackReply(userMessage: string, lang: 'en' | 'id'): string {
  const msg = userMessage.toLowerCase()
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(msg))) {
      return lang === 'id' ? rule.id : rule.en
    }
  }
  // No rule matched → guardrail refusal
  return lang === 'id'
    ? "Saya adalah Asisten AI LocInsights dan hanya bisa membantu seputar LocInsights, inteligensi lokasi, pemilihan lokasi retail, dan analisis ekspansi Bali.\n\nCoba tanyakan tentang:\n- **Fitur platform** (Dashboard, Map Explorer, Opportunities, Deep Analysis, dll.)\n- **Cara composite score dihitung**\n- **Geografi Bali** (kabupaten/kecamatan/kelurahan)\n- **Metodologi** (Huff Gravity, GBR, sumber data)\n\nAtau ketik **\"help\"** untuk melihat topik yang bisa saya bantu."
    : "I'm the LocInsights AI Assistant and can only help with LocInsights, location intelligence, retail site selection, and Bali expansion analysis.\n\nTry asking about:\n- **Platform features** (Dashboard, Map Explorer, Opportunities, Deep Analysis, etc.)\n- **How the composite score is calculated**\n- **Bali geography** (kabupaten/kecamatan/kelurahan)\n- **Methodology** (Huff Gravity, GBR, data sources)\n\nOr type **\"help\"** to see what topics I can help with."
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, lang = 'en', clientConfig } = body as {
      messages: ChatMessage[]
      lang?: 'en' | 'id'
      clientConfig?: ClientConfig | null
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid messages array' },
        { status: 400 }
      )
    }

    // Get the last user message for fallback
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userText = String(lastUserMsg?.content || '').slice(0, 4000)

    // Load config — client-provided config takes priority (lets the user
    // configure AI access from the Settings page on Vercel without needing
    // dashboard access).
    const config = loadConfig(clientConfig || null)

    // === FALLBACK PATH ===
    // If no Z.AI config, use the rule-based LocInsights Help Bot.
    // This ensures chat ALWAYS works on Vercel — even before env vars are set
    // and before the user configures Settings.
    if (!config) {
      const fallbackReply = buildFallbackReply(userText, lang === 'id' ? 'id' : 'en')
      return NextResponse.json({
        reply: fallbackReply,
        source: 'fallback',
        note: 'Rule-based fallback active. Configure AI in Settings, or set ZAI_BASE_URL + ZAI_API_KEY env vars on Vercel for full AI responses.',
      })
    }

    // === Z.AI API PATH ===
    const systemPrompt = buildSystemPrompt(lang === 'id' ? 'id' : 'en')
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role, // don't let caller inject their own system prompt
        content: String(m.content || '').slice(0, 4000), // hard cap per-message length
      })),
    ]

    // Hard cap conversation length to last 20 messages (excluding system)
    const cappedMessages = [
      fullMessages[0],
      ...fullMessages.slice(1).slice(-20),
    ]

    const url = `${config.baseUrl}/chat/completions`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Z-AI-From': 'Z',
    }
    if (config.chatId) headers['X-Chat-Id'] = config.chatId
    if (config.userId) headers['X-User-Id'] = config.userId
    if (config.token) headers['X-Token'] = config.token

    // Build request body — include model if specified (client config path),
    // temperature + max_tokens if set by client.
    const requestBody: Record<string, any> = {
      messages: cappedMessages,
      thinking: { type: 'disabled' },
      stream: false,
    }
    if (config.model) requestBody.model = config.model
    if (typeof config.temperature === 'number' && !Number.isNaN(config.temperature)) {
      requestBody.temperature = config.temperature
    }
    if (typeof config.maxTokens === 'number' && config.maxTokens > 0) {
      requestBody.max_tokens = config.maxTokens
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[chat] Z.AI API error ${response.status}:`, errorBody.slice(0, 500))
        // Fall back to rule-based rather than failing the user
        const fallbackReply = buildFallbackReply(userText, lang === 'id' ? 'id' : 'en')
        return NextResponse.json({
          reply: fallbackReply,
          source: 'fallback',
          note: `Z.AI API returned ${response.status}; using fallback.`,
        })
      }

      const data = await response.json()
      const reply = data?.choices?.[0]?.message?.content || ''

      if (!reply) {
        console.error('[chat] Empty reply from Z.AI:', JSON.stringify(data).slice(0, 500))
        // Fall back rather than empty
        const fallbackReply = buildFallbackReply(userText, lang === 'id' ? 'id' : 'en')
        return NextResponse.json({
          reply: fallbackReply,
          source: 'fallback',
          note: 'Empty Z.AI reply; using fallback.',
          usage: data?.usage,
        })
      }

      return NextResponse.json({
        reply,
        usage: data?.usage,
        source: 'zai',
      })
    } catch (fetchErr: any) {
      clearTimeout(timeout)
      if (fetchErr.name === 'AbortError') {
        // Fall back on timeout
        const fallbackReply = buildFallbackReply(userText, lang === 'id' ? 'id' : 'en')
        return NextResponse.json({
          reply: fallbackReply,
          source: 'fallback',
          note: 'Z.AI request timed out; using fallback.',
        })
      }
      // Fall back on any other fetch error
      const fallbackReply = buildFallbackReply(userText, lang === 'id' ? 'id' : 'en')
      return NextResponse.json({
        reply: fallbackReply,
        source: 'fallback',
        note: `Z.AI fetch error; using fallback.`,
      })
    }
  } catch (err: any) {
    console.error('[chat] Unhandled error:', err)
    // Last-resort fallback
    return NextResponse.json({
      reply: 'Sorry, something went wrong. Please try again.',
      source: 'fallback',
      error: 'Internal server error',
    }, { status: 200 }) // 200 so the client renders the reply
  }
}

/**
 * GET endpoint — health check. Returns whether the chat service is configured.
 */
export async function GET() {
  const config = loadConfig()
  return NextResponse.json({
    configured: !!config,
    hasEnvVars: !!(process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY),
    hasConfigFile: (() => {
      try {
        const paths = [
          path.join(process.cwd(), '.z-ai-config'),
          path.join(os.homedir(), '.z-ai-config'),
          '/etc/.z-ai-config',
        ]
        return paths.some(p => {
          try {
            const c = JSON.parse(fs.readFileSync(p, 'utf-8'))
            return !!(c.baseUrl && c.apiKey)
          } catch {
            return false
          }
        })
      } catch {
        return false
      }
    })(),
    fallbackActive: !config,
    rulesCount: RULES.length,
    note: 'Client may also pass clientConfig in POST body — see Settings page.',
  })
}
