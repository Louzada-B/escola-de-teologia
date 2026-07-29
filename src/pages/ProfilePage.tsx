import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState((profile as any)?.phone || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      // Remove old avatar files
      const { data: existing } = await supabase.storage.from('avatars').list(user.id);
      if (existing?.length) {
        await supabase.storage.from('avatars').remove(existing.map((f) => `${user.id}/${f.name}`));
      }

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl } as any)
        .eq('id', user.id);
      if (updErr) throw updErr;

      await refreshProfile();
      toast.success('Foto atualizada!');
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone } as any)
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Perfil salvo!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada com sucesso!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto">
      <h1 className="section-title text-3xl mb-8">Meu Perfil</h1>

      {/* Avatar */}
      <Card className="card-academic mb-6">
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="w-24 h-24 text-2xl">
              <AvatarImage src={(profile as any)?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <p className="text-sm text-muted-foreground">Clique na foto para alterar</p>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="card-academic mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input value={profile?.email || ''} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Nome Completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nova Senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirmar Nova Senha</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPw} variant="secondary">
            {changingPw ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
