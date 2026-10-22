import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100 shadow-xs">
        <Compass className="w-8 h-8 animate-pulse" />
      </div>

      <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
        404 - Không tìm thấy trang
      </span>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-2">
        Trang không tồn tại
      </h1>

      <p className="text-sm sm:text-base text-slate-500 max-w-md mt-2 leading-relaxed">
        Đường dẫn bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển trong nền tảng cộng đồng.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <Link to="/">
          <Button leftIcon={<Home className="w-4 h-4" />}>
            Quay về trang chủ
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
