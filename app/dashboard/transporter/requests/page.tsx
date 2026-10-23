import { getTransporterRequests } from '@/actions/transport-requests';
import TransportRequestsClient from '@/components/dashboard/TransportRequestsClient';
import { manilaToday } from '@/lib/datetime';

export default async function TransporterRequestsPage() {
  const requests = await getTransporterRequests();

  return <TransportRequestsClient initialRequests={requests} today={manilaToday()} />;
}
