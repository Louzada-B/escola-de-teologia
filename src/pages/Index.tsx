import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, GraduationCap, Users, ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-lg text-foreground">Portal de Teologia</span>
          </div>
          <Link to="/auth">
            <Button>Entrar</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 lg:py-32 text-center">
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-in">
          Estude Teologia <br />
          <span className="text-accent">com profundidade</span>
        </h1>
        <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
          Acesse aulas, materiais de estudo, questionários e muito mais. 
          Uma plataforma acadêmica completa para sua formação teológica.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Começar agora <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: BookOpen,
              title: 'Aulas Organizadas',
              desc: 'Conteúdo estruturado por módulos com vídeos, documentos e materiais de apoio.',
            },
            {
              icon: GraduationCap,
              title: 'Questionários',
              desc: 'Avalie seu aprendizado com questionários interativos após cada aula.',
            },
            {
              icon: Users,
              title: 'Comunicação',
              desc: 'Mural de avisos e calendário para acompanhar aulas síncronas e provas.',
            },
          ].map((f) => (
            <div key={f.title} className="card-academic text-center">
              <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground font-body">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-muted-foreground font-body">
            © {new Date().getFullYear()} Portal de Teologia. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
