import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Link as LinkIcon, Video, Upload, ExternalLink } from "lucide-react";
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
  created_by: string;
  created_at: string;
}

const categoryOptions = [
  { value: "geral", label: "Geral" },
  { value: "leitura", label: "Leitura Complementar" },
  { value: "video", label: "Vídeos" },
  { value: "modelo", label: "Modelos e Templates" },
  { value: "ferramenta", label: "Ferramentas" },
  { value: "referencia", label: "Referências" },
];

const typeIcons: Record<string, React.ReactNode> = {
  file: <FileText className="w-4 h-4" />,
  link: <LinkIcon className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
};

function sanitizeFileName(name: string): string {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uuid = crypto.randomUUID().slice(0, 8);
  const ext = safe.includes(".") ? safe.slice(safe.lastIndexOf(".")) : "";
  const base = safe.includes(".") ? safe.slice(0, safe.lastIndexOf(".")) : safe;
  return `${base}_${uuid}${ext}`;
}

export default function ExtraMaterialsManager({ userId }: { userId: string }) {
  const [materials, setMaterials] = useState<ExtraMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState("file");
  const [category, setCategory] = useState("geral");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("extra_materials")
      .select("*")
      .order("created_at", { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMaterialType("file");
    setCategory("geral");
    setExternalUrl("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (materialType === "file" && !selectedFile) {
      toast.error("Selecione um arquivo");
      return;
    }

    if ((materialType === "link" || materialType === "video") && !externalUrl.trim()) {
      toast.error("URL é obrigatória");
      return;
    }

    setUploading(true);

    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;

      if (materialType === "file" && selectedFile) {
        const safeName = sanitizeFileName(selectedFile.name);
        const path = `extra-materials/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("course-files")
          .upload(path, selectedFile);

        if (uploadError) throw uploadError;

        filePath = path;
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type;
      }

      const { error } = await supabase.from("extra_materials").insert({
        title: title.trim(),
        description: description.trim() || null,
        material_type: materialType,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        external_url: materialType !== "file" ? externalUrl.trim() : null,
        category,
        created_by: userId,
      });

      if (error) throw error;

      toast.success("Material adicionado com sucesso!");
      resetForm();
      setDialogOpen(false);
      fetchMaterials();
    } catch (err: any) {
      toast.error("Erro ao adicionar material: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const material = materials.find((m) => m.id === id);
    if (!confirm("Deseja excluir este material?")) return;

    if (material?.file_path) {
      await supabase.storage.from("course-files").remove([material.file_path]);
    }

    const { error } = await supabase.from("extra_materials").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Material excluído");
      fetchMaterials();
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Materiais Extras</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Adicionar Material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Material</Label>
                <Select value={materialType} onValueChange={setMaterialType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">
                      <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Arquivo (PDF, Word, etc.)</span>
                    </SelectItem>
                    <SelectItem value="link">
                      <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Link Externo</span>
                    </SelectItem>
                    <SelectItem value="video">
                      <span className="flex items-center gap-2"><Video className="w-4 h-4" /> Vídeo</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Apostila de Hermenêutica" />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do material..." rows={2} />
              </div>

              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {materialType === "file" ? (
                <div>
                  <Label>Arquivo *</Label>
                  <div className="mt-1">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">
                        {selectedFile ? selectedFile.name : "Clique para selecionar"}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder={materialType === "video" ? "https://youtube.com/watch?v=..." : "https://..."}
                  />
                </div>
              )}

              <Button onClick={handleSubmit} disabled={uploading} className="w-full">
                {uploading ? "Enviando..." : "Adicionar Material"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Nenhum material cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {typeIcons[m.material_type] || typeIcons.file}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{m.title}</p>
                        {m.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{m.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryOptions.find((c) => c.value === m.category)?.label || m.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatSize(m.file_size)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.external_url && (
                          <Button size="icon" variant="ghost" onClick={() => window.open(m.external_url!, "_blank")}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
