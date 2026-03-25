'use client';

import dynamic from 'next/dynamic';

const ApiKeysAuditClient = dynamic(() => import('./client'), { ssr: false });

export default function ApiKeysAuditPage() {
  return <ApiKeysAuditClient />;
}
