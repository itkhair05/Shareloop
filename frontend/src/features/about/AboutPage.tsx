import { Shield, Database, Lock, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export function AboutPage() {
  const architectures = [
    {
      icon: Lock,
      title: 'Authentication & Security',
      description:
        'Stateless JWT Bearer token authentication validated on every request. Passwords securely hashed with BCrypt. Role-based access control protecting admin endpoints.',
    },
    {
      icon: Database,
      title: 'Transactional Integrity',
      description:
        'PostgreSQL with strict database check constraints, triggers, and pessimistic locking preventing race conditions during transactions and reviews.',
    },
    {
      icon: Globe,
      title: 'Decoupled Client Architecture',
      description:
        'React 19 single-page application built on Vite 8, TanStack Query for cache invalidation, and Tailwind CSS for accessible, responsive interfaces.',
    },
    {
      icon: Shield,
      title: 'OpenAPI 3 Documentation',
      description:
        'Fully documented REST API with Swagger UI accessible at /swagger-ui.html with explicit operation-level security mapping.',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">About ShareLoop</h1>
        <p className="text-base text-slate-600 mt-2 leading-relaxed">
          ShareLoop is an open-source, community-oriented item sharing and trading platform designed with enterprise-grade engineering principles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {architectures.map((arch) => (
          <Card key={arch.title}>
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <arch.icon className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">{arch.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{arch.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default AboutPage;
