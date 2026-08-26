import { getTransporterVehicles } from '@/actions/vehicles';
import { getTransporterAvailability } from '@/actions/availability';
import AvailabilityManager from '@/components/dashboard/AvailabilityManager';

export default async function TransporterAvailabilityPage() {
  const [vehicles, availability] = await Promise.all([
    getTransporterVehicles(),
    getTransporterAvailability(),
  ]);

  return (
    <AvailabilityManager
      vehicles={vehicles}
      initialAvailability={availability}
    />
  );
}
