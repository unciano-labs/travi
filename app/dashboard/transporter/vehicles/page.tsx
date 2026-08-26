import { getTransporterVehicles } from '@/actions/vehicles';
import VehicleListClient from '@/components/dashboard/VehicleListClient';

export default async function TransporterVehiclesPage() {
  const vehicles = await getTransporterVehicles();

  return <VehicleListClient initialVehicles={vehicles} />;
}
