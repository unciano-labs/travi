"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

// Section links point at the landing page ("/#id") so they also work from /tours and tour pages.
// `section` drives the scroll-spy highlight on the landing page.
const NAV_LINKS = [
  { name: "Home", href: "/", section: "home" },
  { name: "Tours", href: "/tours", section: "tours" },
  { name: "Destinations", href: "/#destinations", section: "destinations" },
  { name: "How It Works", href: "/#how", section: "how" },
  { name: "For Partners", href: "/#organizers", section: "organizers" },
  { name: "Contact", href: "/contact", section: null },
] as const;

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("#home");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', authUser.id).single();
        setUser({ ...authUser, profile });
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);

      const sections = ['home', 'tours', 'destinations', 'how', 'organizers'];
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
            <Link href="/" className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" aria-hidden="true">
                <circle cx="16" cy="16" r="15" fill="#0EA5E9" opacity=".15"/>
                <path d="M16 4C10 4 6 8.5 6 14c0 6 5 11 10 14 5-3 10-8 10-14C26 8.5 22 4 16 4z" fill="#0EA5E9"/>
                <path d="M16 10c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z" fill="white" opacity=".9"/>
              </svg>
              <span className={`text-xl font-extrabold tracking-tight ${scrolled ? 'text-brand-navy' : 'text-white'}`}>Travi</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold">
              {NAV_LINKS.map((link) => {
                const active = pathname === '/'
                  ? link.section !== null && activeHash === `#${link.section}`
                  : link.href !== '/' && !link.href.startsWith('/#') && pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`transition-colors ${
                      active
                        ? (scrolled ? 'text-brand-dark border-b-2 border-brand-dark pb-1' : 'text-sky-300 border-b-2 border-sky-300 pb-1')
                        : (scrolled ? 'text-slate-600 hover:text-brand-dark' : 'text-slate-200 hover:text-sky-300')
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              {user ? (
                <a href="/dashboard" className="flex items-center gap-2 group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border ${scrolled ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/20'}`}>
                    {user.profile?.avatar_url ? (
                      <img src={user.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className={`${scrolled ? 'text-slate-400 group-hover:text-brand' : 'text-white'}`} />
                    )}
                  </div>
                  <span className={`text-sm font-semibold ${scrolled ? 'text-slate-700' : 'text-white'}`}>Dashboard</span>
                </a>
              ) : (
                <a href="/login" className={`text-sm font-semibold ${scrolled ? 'text-slate-600' : 'text-white'}`}>Sign In</a>
              )}
            </div>

            <button
              className={`lg:hidden p-2 rounded-lg ${scrolled ? 'text-slate-800' : 'text-white'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-20 px-4 pb-6">
          <nav className="grid gap-2 text-sm font-semibold text-slate-700">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-3 rounded-lg hover:bg-sky-50 hover:text-brand-dark"
              >
                {link.name}
              </Link>
            ))}
            <div className="border-t border-slate-100 my-1"></div>
            {user ? (
              <a href="/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-sky-50 text-brand-dark">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center overflow-hidden">
                  {user.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={16} className="text-brand" />
                  )}
                </div>
                <span>Dashboard</span>
              </a>
            ) : (
              <a href="/login" className="px-3 py-3 rounded-lg hover:bg-sky-50 hover:text-brand-dark text-slate-700">
                Sign In
              </a>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
