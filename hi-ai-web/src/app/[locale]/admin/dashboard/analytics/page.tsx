'use client';

import dynamic from 'next/dynamic';

const AnalyticsClient = dynamic(() => import('./client'), { ssr: false });

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
