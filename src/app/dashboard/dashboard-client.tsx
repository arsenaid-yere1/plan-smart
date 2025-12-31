'use client';

import { AISummary } from '@/components/projections';

interface DashboardClientProps {
  projectionResultId: string | null;
  status: 'on-track' | 'needs-adjustment' | 'at-risk';
  projectedRetirementBalance: number;
  yearsUntilDepletion: number | null;
}

export function DashboardClient({
  projectionResultId,
  status,
  projectedRetirementBalance,
  yearsUntilDepletion,
}: DashboardClientProps) {
  return (
    <AISummary
      projectionResultId={projectionResultId}
      status={status}
      projectedRetirementBalance={projectedRetirementBalance}
      yearsUntilDepletion={yearsUntilDepletion}
    />
  );
}
