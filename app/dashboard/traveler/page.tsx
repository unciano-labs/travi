import { MapPin, Calendar, Star } from 'lucide-react';

export default function TravelerDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, Traveler!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-coral/10 text-coral rounded-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming Tours</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">2</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-brand-navy/10 text-brand-navy rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Past Bookings</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">14</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Reviews Left</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">8</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Your Next Adventure</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row gap-6 items-center">
          <div className="w-full sm:w-48 h-32 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
             {/* Mock Image placeholder */}
             <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
               <MapPin className="w-8 h-8 opacity-50" />
             </div>
          </div>
          <div className="flex-1">
            <div className="inline-block px-3 py-1 bg-coral/10 text-coral text-xs font-semibold rounded-full mb-2">
              In 3 Days
            </div>
            <h3 className="text-xl font-bold text-slate-900">Coron Ultimate Tour</h3>
            <p className="text-slate-500 mt-1">Palawan Island Hopping Co.</p>
            <div className="flex gap-4 mt-4">
               <div className="text-sm">
                 <span className="text-slate-500 block">Date:</span>
                 <span className="font-medium text-slate-900">Oct 24, 2026</span>
               </div>
               <div className="text-sm">
                 <span className="text-slate-500 block">Pax:</span>
                 <span className="font-medium text-slate-900">2 Adults</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
