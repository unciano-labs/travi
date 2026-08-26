import { getTransporterRequests } from '@/actions/transport-requests';
import TransportRequestsClient from '@/components/dashboard/TransportRequestsClient';

export default async function TransporterRequestsPage() {
  const requests = await getTransporterRequests();

  return <TransportRequestsClient initialRequests={requests} />;
}
