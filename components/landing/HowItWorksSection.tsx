export default function HowItWorksSection() {
  const steps = [
    {
      num: "1",
      title: "Find Your Tour",
      desc: "Search by destination, dates, and number of travelers. Browse options from trusted local organizers."
    },
    {
      num: "2",
      title: "Customize & Book",
      desc: "Add optional transport, specify your requirements, and securely checkout your booking online."
    },
    {
      num: "3",
      title: "Enjoy the Journey",
      desc: "Receive instant confirmation. Meet your organizer at the location and enjoy your Philippine adventure."
    }
  ];

  return (
    <section id="how" className="py-16 lg:py-24 bg-brand-navy text-white relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2">Simple Process</p>
          <h2 className="text-2xl lg:text-4xl font-extrabold mb-4">How Travi Works</h2>
          <p className="text-slate-400 text-sm">Booking your local adventure is fast, secure, and hassle-free.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative">
          <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-slate-800 border-t border-dashed border-slate-600"></div>
          
          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-sky-500 flex items-center justify-center text-xl font-extrabold text-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)] mb-5">
                {step.num}
              </div>
              <h3 className="text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-slate-400 text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
