"use client";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("#home");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      
      const sections = ['home', 'tours', 'destinations', 'how', 'organizers', 'contact'];
      let current = "#home";
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 100) {
          current = "#" + id;
        }
      }
      setActiveHash(current);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <a href="#home" className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" aria-hidden="true">
                <circle cx="16" cy="16" r="15" fill="#0EA5E9" opacity=".15"/>
                <path d="M16 4C10 4 6 8.5 6 14c0 6 5 11 10 14 5-3 10-8 10-14C26 8.5 22 4 16 4z" fill="#0EA5E9"/>
                <path d="M16 10c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z" fill="white" opacity=".9"/>
              </svg>
              <span className={`text-xl font-extrabold tracking-tight ${scrolled ? 'text-brand-navy' : 'text-white'}`}>Travi</span>
            </a>
            
            <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold">
              {[
                { name: 'Home', href: '#home' },
                { name: 'Tours', href: '#tours' },
                { name: 'Destinations', href: '#destinations' },
                { name: 'How It Works', href: '#how' },
                { name: 'For Partners', href: '#organizers' },
                { name: 'Contact', href: '#contact' }
              ].map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className={`transition-colors ${
                    activeHash === link.href 
                      ? (scrolled ? 'text-brand-dark border-b-2 border-brand-dark pb-1' : 'text-sky-300 border-b-2 border-sky-300 pb-1') 
                      : (scrolled ? 'text-slate-600 hover:text-brand-dark' : 'text-slate-200 hover:text-sky-300')
                  }`}
                >
                  {link.name}
                </a>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <a href="/login" className={`text-sm font-semibold ${scrolled ? 'text-slate-600' : 'text-white'}`}>Sign In</a>
              <a href="#contact" className="bg-brand hover:bg-brand-dark transition-colors text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-card">
                Get Started
              </a>
            </div>

            <button 
              className={`lg:hidden p-2 rounded-lg ${scrolled ? 'text-slate-800' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-20 px-4 pb-6">
          <nav className="grid gap-2 text-sm font-semibold text-slate-700">
            {['Home', 'Tours', 'Destinations', 'How It Works', 'For Partners', 'Contact'].map((name) => {
              const href = `#${name.toLowerCase().replace(/ /g, '') === 'forpartners' ? 'organizers' : name.toLowerCase().replace(/ /g, '')}`;
              return (
                <a 
                  key={name} 
                  href={href} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-3 rounded-lg hover:bg-sky-50 hover:text-brand-dark"
                >
                  {name}
                </a>
              );
            })}
            <a href="#contact" className="mt-4 bg-brand text-white text-center px-5 py-3 rounded-xl font-bold">Get Started</a>
          </nav>
        </div>
      )}
    </>
  );
}
