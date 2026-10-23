import { getOrganizerTransportRequests } from '@/actions/transport-requests';
import OrganizerTransportClient from '@/components/dashboard/OrganizerTransportClient';

export default async function OrganizerTransportPage() {
  const requests = await getOrganizerTransportRequests();

  return <OrganizerTransportClient initialRequests={requests} />;
}
