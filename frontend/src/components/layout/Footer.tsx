import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>© {currentYear} ShareLoop Platform.</span>
            <span>•</span>
            <span>Sustainable Community Exchange</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link to="/about" className="hover:text-slate-800 transition-colors">
              About
            </Link>
            <span>•</span>
            <Link to="/admin" className="hover:text-slate-800 transition-colors">
              Admin
            </Link>
            <span>•</span>
            <a
              href="https://github.com/itkhair05/Shareloop"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-800 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
