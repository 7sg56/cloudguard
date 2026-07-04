import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-200 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-slate-600 mb-2">Page not found</h2>
        <p className="text-sm text-slate-500 mb-6">The page you are looking for does not exist.</p>
        <Link href="/dashboard" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
