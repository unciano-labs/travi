export default function PartnersSection() {
  return (
    <section id="organizers" className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-navy to-slate-900 rounded-3xl p-8 lg:p-12 overflow-hidden relative shadow-lift">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-brand/20 blur-3xl rounded-full"></div>
          
          <div className="relative z-10 lg:w-2/3">
            <p className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-3">For Tour Organizers</p>
            <h2 className="text-2xl lg:text-4xl font-extrabold text-white mb-4">Grow Your Tourism Business</h2>
            <p className="text-slate-300 text-sm mb-8 max-w-xl leading-relaxed">
              Join our platform to list your tour packages, manage bookings seamlessly, and reach more travelers exploring the Philippines. 
              Zero setup fees. Pay only a small commission per successful booking.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/signup?role=organizer" className="bg-brand hover:bg-brand-dark transition-colors text-white text-sm font-bold px-6 py-3 rounded-xl shadow-card">
                Register as Organizer
              </a>
              <a href="/signup?role=transporter" className="text-white hover:text-sky-300 transition-colors text-sm font-bold px-4 py-3">
                Have vehicles? Join as a Transporter →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
