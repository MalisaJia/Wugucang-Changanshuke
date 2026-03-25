'use client';

import dynamic from 'next/dynamic';

const RoutingClient = dynamic(() => import('./client'), { ssr: false });

export default function RoutingPage() {
  return <RoutingClient />;
}
