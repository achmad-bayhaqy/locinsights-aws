/**
 * Anti-Sleep Cron Endpoint
 *
 * Called by Vercel Cron daily (see vercel.json — Hobby tier doesn't allow every-15-min).
 * Performs lightweight pings to:
 *   1. Supabase (REST SELECT) — prevents DB auto-pause on free tier
 *   2. Hugging Face Static Space root URL — verifies reachability
 *      (static Spaces don't sleep, so this is a health check, not anti-sleep)
 *
 * Architecture note (2026-08-08):
 *   The HF Space was converted from Gradio SDK (server-side Python, needed
 *   cpu-basic quota which free tier doesn't have) to Gradio Lite (static SDK,
 *   Python runs in browser via Pyodide). Static Spaces never sleep, so the
 *   "anti-sleep" ping is now just a reachability check.
 *
 * Security: validates Vercel CRON secret header to prevent public abuse.
 *
 * Env vars:
 *   - CRON_SECRET (required) — shared secret for cron auth
 *   - NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY — service role key (server-side only)
 *   - ML_API_URL (optional) — HF Static Space URL (e.g., https://bayhaqy-locinsights-ml.static.hf.space)
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    timestamp: new Date().toISOString(),
    supabase: "skipped" as string,
    hf_static_space: "skipped" as string,
  };

  // 1. Ping Supabase (lightweight: fetch a single row from brands table)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/brands?select=id&limit=1`, {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      results.supabase = r.ok ? "ok" : `error_http_${r.status}`;
    } catch (e) {
      results.supabase = `error: ${(e as Error).message.slice(0, 80)}`;
    }
  }

  // 2. Ping Hugging Face Static Space (reachability check — static Spaces don't sleep)
  // The ML_API_URL env var now points to the static Space root (no /health endpoint).
  // ML_API_TOKEN is no longer needed (static Space has no server-side auth).
  const hfStaticUrl = process.env.ML_API_URL;
  if (hfStaticUrl) {
    try {
      const url = hfStaticUrl.replace(/\/$/, "");
      const r = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        // No auth header — static Space is public HTML
      });
      results.hf_static_space = r.ok ? "ok" : `error_http_${r.status}`;
    } catch (e) {
      results.hf_static_space = `error: ${(e as Error).message.slice(0, 80)}`;
    }
  }

  console.log("[cron/anti-sleep]", results);
  return NextResponse.json({ ok: true, ...results });
}
