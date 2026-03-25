'use client';

import dynamic from 'next/dynamic';

const AuditLogsClient = dynamic(() => import('./client'), { ssr: false });

export default function AuditLogsPage() {
  return <AuditLogsClient />;
}
