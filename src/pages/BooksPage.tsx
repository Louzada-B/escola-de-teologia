import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, BookMarked } from 'lucide-react';

export default function BooksPage() {
  const [books, setBooks] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('book_promotions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setBooks(data || []));
  }, []);

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Promoções de Livros</h1>

      {books.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma promoção disponível.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <Card key={book.id} className="card-academic overflow-hidden">
              {book.cover_url ? (
                <div className="aspect-[3/4] bg-muted">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                  <BookMarked className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <h3 className="font-heading font-semibold text-lg">{book.title}</h3>
                {book.author && (
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                )}
                {book.description && (
                  <p className="text-sm text-foreground/70">{book.description}</p>
                )}
                {book.purchase_url && (
                  <a href={book.purchase_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <ExternalLink className="w-3 h-3 mr-1" /> Comprar
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
