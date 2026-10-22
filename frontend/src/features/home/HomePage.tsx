import { Link } from 'react-router-dom';
import { Gift, ArrowLeftRight, Search, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HealthStatusCard } from '@/features/health/HealthStatusCard';

export function HomePage() {
  const pillars = [
    {
      icon: Gift,
      title: 'Free Item Sharing',
      description:
        'Declutter sustainably by gifting kitchenware, tools, books, and appliances to verified neighbors who need them.',
      tag: 'Zero Waste',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      icon: ArrowLeftRight,
      title: 'Second-Hand Trading',
      description:
        'Buy, sell, or trade quality pre-loved goods locally with transparent history and dual-confirmation handoffs.',
      tag: 'Fair Exchange',
      color: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      icon: Search,
      title: 'Wanted Item Requests',
      description:
        'Looking for camping gear, textbooks, or specific parts? Broadcast an item request to your local community circle.',
      tag: 'Community Driven',
      color: 'bg-sky-50 text-sky-700 border-sky-200',
    },
  ];

  const stackSpecs = [
    { area: 'Backend Framework', detail: 'Spring Boot 3.5.16 • Java 17' },
    { area: 'Frontend Foundation', detail: 'React 19 • TypeScript • Vite 8 • Tailwind v4' },
    { area: 'State & Networking', detail: 'TanStack Query v5 • Axios Client' },
    { area: 'Persistence Layer', detail: 'PostgreSQL 16 Alpine • Flyway Migrations' },
  ];

  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sustainable Neighborhood Exchange</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
          ShareLoop
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          A production-minded community exchange connecting neighbors for free item gifting, fair second-hand trading, and wanted-item requests.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/explore">
            <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Explore Community Loop
            </Button>
          </Link>
          <Link to="/about">
            <Button variant="outline" size="lg">
              Architecture Overview
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map((pillar) => (
          <Card key={pillar.title} className="hover:border-slate-300 transition-all">
            <CardHeader>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <pillar.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <Badge variant="neutral">{pillar.tag}</Badge>
              </div>
              <CardTitle className="text-base">{pillar.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{pillar.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Real Live Backend Health Check Component */}
      <section className="max-w-3xl mx-auto">
        <HealthStatusCard />
      </section>

      {/* Technical Architecture Badge Card */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase 1: Production Frontend Foundation</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly decoupled full-stack architecture matching the audited Phase 13A backend
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stackSpecs.map((spec) => (
                <div key={spec.area} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {spec.area}
                  </span>
                  <span className="block text-xs font-medium text-slate-900 mt-1">
                    {spec.detail}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default HomePage;
