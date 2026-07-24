import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Link as LinkIcon, Video, Download, ExternalLink, Search, FolderOpen, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExtraMaterial {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  external_url: string | null;
  category: string;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  geral: "Geral",
  leitura: "Leitura Complementar",
  video: "Vídeos",
  modelo: "Modelos e Templates",
  ferramenta: "Ferramentas",
  referencia: "Referências",
};

const typeIcons: Record<string, React.ReactNode> = {
  file: <FileText className="w-5 h-5" />,
  link: <LinkIcon className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
};

const typeColors: Record<string, string> = {
  file: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  link: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  video: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExtraMaterialsPage() {
  const [materials, setMaterials] = useState<ExtraMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("extra_materials")
      .select("*")
      .order("order_index", { ascending: true });
    setMaterials(data || []);
    setLoading(false);
  };

  const handleDownload = async (material: ExtraMaterial) => {
    if (material.material_type === "link" || material.material_type === "video") {
      window.open(material.external_url || "", "_blank");
      return;
    }
    if (material.file_path) {
      const { data } = supabase.storage.from("course-files").getPublicUrl(material.file_path);
      window.open(data.publicUrl, "_blank");
    }
  };

  const filtered = materials.filter((m) => {
    const matchSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || m.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const categories = [...new Set(materials.map((m) => m.category))];

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="section-title flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-primary" />
          Materiais Extras
        </h1>
        <p className="text-sm text-muted-foreground">
          Recursos complementares para enriquecer seus estudos
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar materiais..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {categoryLabels[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum material encontrado</p>
            <p className="text-sm">
              {search || categoryFilter !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Os materiais serão adicionados em breve"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((material) => (
            <Card
              key={material.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleDownload(material)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={`p-2 rounded-lg ${typeColors[material.material_type] || typeColors.file}`}>
                    {typeIcons[material.material_type] || typeIcons.file}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {categoryLabels[material.category] || material.category}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2 group-hover:text-primary transition-colors">
                  {material.title}
                </CardTitle>
                {material.description && (
                  <CardDescription className="line-clamp-2">{material.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(material.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2">
                    {material.file_size && (
                      <span>{formatFileSize(material.file_size)}</span>
                    )}
                    {material.material_type === "file" ? (
                      <Download className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
