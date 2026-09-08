import RelayApp from '@/components/relay-app';
export default function Page(){ return <RelayApp demo={process.env.RELAY_DEMO_MODE==='true'} />; }

export const dynamic = 'force-dynamic';
