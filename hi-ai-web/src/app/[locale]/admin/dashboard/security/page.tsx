'use client';

import dynamic from 'next/dynamic';

const SecurityClient = dynamic(() => import('./client'), { ssr: false });

export default function SecurityPage() {
  return <SecurityClient />;
}
