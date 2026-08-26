'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Bus, Users, Tag, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import VehicleModal from './VehicleModal';
import { toggleVehicleStatus, deleteVehicle } from '@/actions/vehicles';
import { useRouter } from 'next/navigation';

interface VehicleListClientProps {
  initialVehicles: any[];
}

export default function VehicleListClient({ initialVehicles }: VehicleListClientProps) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(initialVehicles);

  useEffect(() => {
    setVehicles(initialVehicles);
  }, [initialVehicles]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    const res = await toggleVehicleStatus(vehicle.id, vehicle.status);
    setActionLoading(null);

    if (res.success) {
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicle.id ? { ...v, status: res.status } : v))
      );
      router.refresh();
    }
  };

  const handleDelete = async (vehicleId: string) => {
    setActionLoading(`delete-${vehicleId}`);
    const res = await deleteVehicle(vehicleId);
    setActionLoading(null);
    setDeleteConfirmId(null);

    if (res.success) {
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      router.refresh();
    }
  };

  const defaultVehicleImage = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80";

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vehicles Fleet</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your transport fleet inventory, seating capacities, and operational availability.
          </p>
        </div>
        {vehicles.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-coral hover:bg-coral/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-coral/20 hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      </div>

      {/* Vehicles Grid / Empty State */}
      {vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-coral/10 text-coral rounded-2xl flex items-center justify-center mx-auto">
            <Bus className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No vehicles listed yet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Add your first van, bus, car, or SUV to start receiving transport booking requests from Tour Organizers.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-coral hover:bg-coral/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Your First Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((v) => {
            const isDeleting = actionLoading === `delete-${v.id}`;
            const isToggling = actionLoading === `toggle-${v.id}`;
            const photo = v.photos?.[0] || defaultVehicleImage;

            return (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group"
              >
                {/* Photo Header */}
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                  <Image
                    src={photo}
                    alt={v.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${
                        v.status === 'active'
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-slate-700/90 text-slate-200'
                      }`}
                    >
                      {v.status === 'active' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {v.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute bottom-3 left-3 text-white">
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-black/40 px-2.5 py-1 rounded-lg backdrop-blur-md">
                      {v.vehicle_type}
                    </span>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg group-hover:text-coral transition-colors line-clamp-1">
                        {v.name}
                      </h3>
                      {v.plate_number && (
                        <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {v.plate_number}
                        </span>
                      )}
                    </div>

                    {v.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{v.seat_capacity} Seats Capacity</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium justify-end">
                      <Tag className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-900">
                        {v.rate_per_day ? `₱${Number(v.rate_per_day).toLocaleString()}/day` : 'Contact for rate'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleStatus(v)}
                      disabled={isToggling}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Mark {v.status === 'active' ? 'Inactive' : 'Active'}</span>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="p-2 text-slate-400 hover:text-brand-navy hover:bg-slate-50 rounded-lg transition-colors"
                        title="Edit Vehicle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {deleteConfirmId === v.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100 animate-fade-in">
                          <button
                            onClick={() => handleDelete(v.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                          >
                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-1 text-slate-500 hover:text-slate-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(v.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
    </div>
  );
}
