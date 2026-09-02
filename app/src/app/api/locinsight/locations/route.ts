/**
 * Hierarchical location picker endpoint.
 *
 * GET /api/locinsight/locations
 *   Returns the full admin hierarchy for cascading dropdowns:
 *     - countries:  [{id, name, iso2, iso3}]
 *     - provinces:  [{code, name, country, country_id, lat, lng}]  (filtered by ?country_id=)
 *     - kabupaten:  [{code, name, type, province, province_code, lat, lng}]  (filtered by ?province_code=)
 *     - kecamatan:  [{code, name, kabupaten_code, lat, lng}]   (filtered by ?kab_code=)
 *     - kelurahan:  [{code, name, kec_code, kec_name, kab_code, kab_name, lat, lng}]  (filtered by ?kec_code=)
 *
 * Used by the unified scraper UI for cascading dropdowns:
 *   Country → Province → Kabupaten → Kecamatan → Kelurahan
 *
 * NOTE: Default DB only has Indonesia → Bali, but the API supports the full
 * hierarchy so users can add more countries/provinces via the Data Manager.
 *
 * TENANT ISOLATION: This endpoint serves SHARED reference data (admin
 * boundaries have no tenant_id column). The route is public (no auth required
 * — the middleware matcher excludes /api/locinsight/locations). No tenant
 * filter is applied.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // cache for 1 hour (admin boundaries rarely change)

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const sp = req.nextUrl.searchParams
    const countryId = sp.get('country_id') || undefined
    const provinceCode = sp.get('province_code') || undefined
    const kabCode = sp.get('kab_code') || undefined
    const kecCode = sp.get('kec_code') || undefined

    // Parallel fetch — admin boundaries are independent
    const [countries, provinces, kabupaten, kecamatan, kelurahan] = await Promise.all([
      prisma.country.findMany({
        select: { id: true, name: true, iso2: true, iso3: true },
        orderBy: { name: 'asc' },
      }),
      prisma.province.findMany({
        where: countryId ? { country_id: countryId } : undefined,
        select: {
          code: true,
          name: true,
          country: true,
          country_id: true,
          lat: true,
          lng: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.kabupaten.findMany({
        where: provinceCode ? { province_code: provinceCode } : undefined,
        select: {
          code: true,
          name: true,
          type: true,
          province: true,
          province_code: true,
          lat: true,
          lng: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.kecamatan.findMany({
        where: kabCode ? { kabupaten_code: kabCode } : undefined,
        select: {
          code: true,
          name: true,
          kabupaten_code: true,
          lat: true,
          lng: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.kelurahan.findMany({
        where: kecCode ? { kec_code: kecCode } : undefined,
        select: {
          code: true,
          name: true,
          kec_code: true,
          kec_name: true,
          kab_code: true,
          kab_name: true,
          lat: true,
          lng: true,
        },
        orderBy: { name: 'asc' },
        take: 5000, // safety cap
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        countries,
        provinces,
        kabupaten,
        kecamatan,
        kelurahan,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to load locations' },
      { status: 500 },
    )
  }
}
