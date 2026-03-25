'use client';

import dynamic from 'next/dynamic';

const PaymentsClient = dynamic(() => import('./client'), { ssr: false });

export default function PaymentsPage() {
  return <PaymentsClient />;
}
