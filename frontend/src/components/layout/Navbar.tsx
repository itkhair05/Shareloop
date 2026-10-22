import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-sm font-medium transition-colors px-3 py-1.5 rounded-md',
      isActive
        ? 'text-emerald-700 bg-emerald-50 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-1">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-950 tracking-tight leading-none">
                ShareLoop
              </span>
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mt-0.5">
                Community Exchange
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/explore" className={navLinkClass}>
              Explore
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
          </nav>

          {/* Right Action / Admin Navigation */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin Console</span>
            </Link>
            <Badge variant="neutral" withDot className="text-xs">
              <Activity className="w-3 h-3 text-emerald-600 mr-1" />
              Phase 1 Core
            </Badge>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1">
          <NavLink
            to="/"
            end
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'block px-3 py-2 rounded-md text-base font-medium',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/explore"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'block px-3 py-2 rounded-md text-base font-medium',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            Explore
          </NavLink>
          <NavLink
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                'block px-3 py-2 rounded-md text-base font-medium',
                isActive
                  ? 'text-emerald-700 bg-emerald-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            About
          </NavLink>
          <div className="pt-2 border-t border-slate-100">
            <Link
              to="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <Shield className="w-4 h-4 text-slate-500" />
              <span>Admin Console</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
