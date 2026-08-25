export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-deep text-slate-400 py-12 lg:py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          
          <div className="lg:col-span-1">
            <a href="#home" className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" aria-hidden="true">
                <circle cx="16" cy="16" r="15" fill="#0EA5E9" opacity=".2"/>
                <path d="M16 4C10 4 6 8.5 6 14c0 6 5 11 10 14 5-3 10-8 10-14C26 8.5 22 4 16 4z" fill="#0EA5E9"/>
              </svg>
              <span className="text-lg font-extrabold text-white tracking-tight">Orgy</span>
            </a>
            <p className="text-xs mb-6 max-w-xs leading-relaxed">The premier marketplace for local tours and transport in the Philippines. Discover your next adventure.</p>
            <div className="flex items-center gap-3">
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 hover:bg-brand hover:text-white flex items-center justify-center transition-colors">FB</a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 hover:bg-brand hover:text-white flex items-center justify-center transition-colors">IG</a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 hover:bg-brand hover:text-white flex items-center justify-center transition-colors">X</a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Travelers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-brand transition-colors">Browse Tours</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Popular Destinations</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Traveler Support</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Trust & Safety</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Partners</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-brand transition-colors">Become an Organizer</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Register as Transport</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Partner Dashboard</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Partner Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#" className="hover:text-brand transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-brand transition-colors">Refund Policy</a></li>
            </ul>
          </div>

        </div>
        
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} Orgy Philippines. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Made in PH 🇵🇭</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
