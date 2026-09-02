# Catatan Operasional & Best Practices (2026-09-02)

## Diterapkan
1. **CloudFront ORP**: managed `AllViewerExceptHostHeader` — memperbaiki bug
   full-page reload (header RSC kini sampai ke Next.js).
2. **AWS WAF** `locinsights-waf`: AWSManagedRulesCommonRuleSet +
   KnownBadInputs (block) + rate-limit 2000 req/5 menit/IP — terasosiasi ke
   distribusi app & ML.
3. **RDS deletion protection = ON** (encrypted, backup 7 hari, private
   subnet, auto minor upgrade sudah aktif sebelumnya).
4. **SW v4** (bypass RSC, network-first HTML) — mencegah reload pasca-deploy.
5. **Task def immutable per versi** (:v7) untuk web & sync; scheduler
   EventBridge menunjuk revisi eksplisit.

## Rekomendasi berikutnya (biaya/mutu)
- **Multi-AZ RDS** (+~USD 26/bln) — HA penuh; saat ini single-AZ.
- **CloudFront standard logging** ke S3 — audit akses (±USD 0,75/bln).
- **VPC Flow Logs → S3** — jejak jaringan (±USD 1/bln).
- **Secrets rotation** berkala utk NEXTAUTH_SECRET/DATABASE_URL.
- Enable Bedrock model access utk Claude Sonnet/gpt-oss (butuh akses akun).
