'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Bus, Users, Tag, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import VehicleModal from './VehicleModal';
import { toggleVehicleStatus, deleteVehicle } from '@/actions/vehicles';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface VehicleListClientProps {
  initialVehicles: any[];
}

export default function VehicleListClient({ initialVehicles }: VehicleListClientProps) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(initialVehicles);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) setVehicles(initialVehicles);
    });
    return () => { mounted = false; };
  }, [initialVehicles]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setSelectedVehicle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (vehicle: any) => {
    setActionLoading(`toggle-${vehicle.id}`);
    setError(null);
    const res = await toggleVehicleStatus(vehicle.id, vehicle.status);
    setActionLoading(null);
    if (!res.success) setError(res.error);

    if (res.success) {
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, status: res.status } : v))
      );
      router.refresh();
    }
  };

  const handleDelete = async (vehicleId: string) => {
    setActionLoading(`delete-${vehicleId}`);
    setError(null);
    const res = await deleteVehicle(vehicleId);
    setActionLoading(null);
    setDeleteConfirmId(null);
    if (!res.success) setError(res.error);

    if (res.success) {
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      router.refresh();
    }
  };

  const defaultVehicleImage = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80";

  return (
    <>
      <PageHeader
        title="Vehicles Fleet"
        description="Manage your transport fleet inventory, seating capacities, and operational availability."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Vehicles' }]}
        actions={
          vehicles.length > 0 && (
            <Button type="button" onClick={handleOpenAdd}>
              <Plus /> Add Vehicle
            </Button>
          )
        }
      />

      {error && (
        <Alert variant="lighterror" className="mb-6">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Vehicles Grid / Empty State */}
      {vehicles.length === 0 ? (
        <CardBox className="mx-auto max-w-lg">
          <EmptyState
            icon={Bus}
            title="No vehicles listed yet"
            description="Add your first van, bus, car, or SUV to start receiving transport booking requests from Tour Organizers."
            action={
              <Button type="button" onClick={handleOpenAdd}>
                <Plus /> Add Your First Vehicle
              </Button>
            }
          />
        </CardBox>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const isDeleting = actionLoading === `delete-${v.id}`;
            const isToggling = actionLoading === `toggle-${v.id}`;
            const photo = v.photos?.[0] || defaultVehicleImage;

            return (
              <CardBox key={v.id} className="group gap-0 overflow-hidden p-0">
                {/* Photo Header */}
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <Image
                    src={photo}
                    alt={v.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-transparent to-transparent"></div>

                  {/* Status Badge */}
                  <div className="absolute right-3 top-3">
                    <Badge variant={v.status === 'active' ? 'success' : 'gray'}>
                      {v.status === 'active' ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <XCircle className="size-3.5" />
                      )}
                      {v.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute bottom-3 left-3 text-white">
                    <span className="rounded-md bg-dark/50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
                      {v.vehicle_type}
                    </span>
                  </div>
                </div>

                {/* Details Body */}
                <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                        {v.name}
                      </h3>
                      {v.plate_number && (
                        <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-bodytext">
                          {v.plate_number}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      OR/CR:{' '}
                      <span className={v.orcr_status === 'verified' ? 'font-medium text-successemphasis' : 'font-medium text-foreground'}>
                        {v.orcr_status === 'verified' ? 'Verified' : v.orcr_status === 'submitted' ? 'In review' : 'Not uploaded'}
                      </span>
                    </p>

                    {v.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {v.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-bodytext">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Users className="size-4 text-muted-foreground" />
                      <span>{v.seat_capacity} Seats Capacity</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 font-medium">
                      <Tag className="size-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {v.rate_per_day ? `₱${Number(v.rate_per_day).toLocaleString()}/day` : 'Contact for rate'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleToggleStatus(v)}
                      disabled={isToggling}
                      className="text-bodytext"
                    >
                      {isToggling ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <span>Mark {v.status === 'active' ? 'Inactive' : 'Active'}</span>
                      )}
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghostprimary"
                        size="iconsm"
                        onClick={() => handleOpenEdit(v)}
                        title="Edit Vehicle"
                        aria-label="Edit Vehicle"
                      >
                        <Edit2 />
                      </Button>

                      {deleteConfirmId === v.id ? (
                        <div className="flex items-center gap-1 rounded-md bg-lighterror p-1">
                          <Button
                            type="button"
                            variant="error"
                            size="xs"
                            onClick={() => handleDelete(v.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? <Loader2 className="animate-spin" /> : 'Confirm'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-muted-foreground"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghosterror"
                          size="iconsm"
                          onClick={() => setDeleteConfirmId(v.id)}
                          title="Delete Vehicle"
                          aria-label="Delete Vehicle"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardBox>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <VehicleModal
        key={isModalOpen ? (selectedVehicle?.id || 'new') : 'closed'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vehicleToEdit={selectedVehicle}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
