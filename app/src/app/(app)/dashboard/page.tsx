'use client'

/**
 * /dashboard — Overview & KPI
 */

import { Dashboard } from '@/components/locinsight/dashboard'
import { PermissionGate } from '@/components/locinsight/permission-gate'
import { useApp } from '@/lib/app-context'

export default function DashboardPage() {
  const { overview, selectedKelurahanId, setSelectedKelurahanId, navigate } = useApp()

  return (
    <PermissionGate menu="dashboard">
      {overview && (
        <Dashboard
          stats={overview.stats}
          topOpportunities={overview.top_opportunities}
          onSelectKelurahan={(id) => {
            setSelectedKelurahanId(id)
            navigate('/analysis')
          }}
          onNavigate={navigate}
        />
      )}
    </PermissionGate>
  )
}
