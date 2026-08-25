export default function ToursSection() {
  const tours = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1544413155-44282362b7ff?auto=format&fit=crop&w=600&q=80",
      category: "Island Hopping",
      title: "Coron Ultimate Tour",
      location: "Coron, Palawan",
      duration: "3 Days, 2 Nights",
      price: "4,500",
      rating: 4.9,
      reviews: 128,
      organizer: "Palawan Adventures"
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1520638515091-628d32b509f6?auto=format&fit=crop&w=600&q=80",
      category: "Culture & Heritage",
      title: "Vigan Historical Walk",
      location: "Vigan City, Ilocos Sur",
      duration: "1 Day",
      price: "1,200",
      rating: 4.8,
      reviews: 94,
      organizer: "Heritage Tours PH"
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=600&q=80",
      category: "Nature & Adventure",
      title: "Mt. Pulag Summit Trek",
      location: "Kabayan, Benguet",
      duration: "2 Days, 1 Night",
      price: "3,800",
      rating: 4.7,
      reviews: 215,
      organizer: "Summit Seekers"
    }
  ];

  return (
    <section id="tours" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-brand mb-2">Curated Packages</p>
          <h2 className="text-2xl lg:text-4xl font-extrabold text-slate-900 mb-4">Top Rated Tours</h2>
          <p className="text-slate-600 text-sm">Experience the best of the Philippines with packages curated by our top-rated local organizers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.map(tour => (
            <div key={tour.id} className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-card transition-all duration-300 flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <img src={tour.image} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-brand-dark text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
                  {tour.category}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-extrabold text-lg text-slate-900 leading-tight group-hover:text-brand transition-colors"><a href="#">{tour.title}</a></h3>
                  <div className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold">
                    ★ {tour.rating}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mb-4">
                  <span className="flex items-center gap-1">📍 {tour.location}</span>
                  <span className="flex items-center gap-1">⏱️ {tour.duration}</span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Starting at</p>
                    <p className="font-extrabold text-lg text-slate-900">₱ {tour.price}</p>
                  </div>
                  <a href="#" className="bg-brand/10 hover:bg-brand text-brand hover:text-white transition-colors text-xs font-bold px-4 py-2 rounded-lg">View Details</a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a href="#" className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-brand text-slate-700 hover:text-brand transition-colors text-sm font-bold px-6 py-3 rounded-xl shadow-sm">
            Load More Tours
          </a>
        </div>
      </div>
    </section>
  );
}
