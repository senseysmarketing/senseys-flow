import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, UserPlus, Mail, Shield, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  full_name: string | null;
  user_id: string;
  created_at: string;
  email?: string;
  role?: {
    id: string;
    name: string;
  } | null;
}

const TeamManagement = () => {
  const { user } = useAuth();
  const { roles, hasPermission, isOwner, refetch: refetchPermissions } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string>("");
  const [memberForm, setMemberForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role_id: ""
  });

  const canManageTeam = hasPermission('team.manage');

  useEffect(() => {
    if (user) {
      fetchTeamMembers();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user_roles with roles
      const { data: userRoles, error: userRolesError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          roles (
            id,
            name
          )
        `);

      if (userRolesError) {
        console.error("Erro ao buscar roles:", userRolesError);
      }

      // Merge profiles with roles — filter out orphan profiles without a role
      const membersWithRoles = (profiles || [])
        .map(profile => {
          const userRole = userRoles?.find(ur => ur.user_id === profile.user_id);
          return {
            ...profile,
            role: userRole?.roles as { id: string; name: string } | null
          };
        })
        .filter(member => member.role !== null);

      setTeamMembers(membersWithRoles);
    } catch (error) {
      console.error("Erro ao buscar membros da equipe:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os membros da equipe."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!memberForm.email || !memberForm.password || !memberForm.full_name || !memberForm.role_id) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Todos os campos são obrigatórios, incluindo o tipo de usuário."
      });
      return;
    }

    if (memberForm.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres."
      });
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: {
          email: memberForm.email,
          password: memberForm.password,
          full_name: memberForm.full_name,
          role_id: memberForm.role_id
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Sucesso",
        description: "Membro da equipe criado com sucesso!"
      });

      setIsDialogOpen(false);
      setMemberForm({ email: "", password: "", full_name: "", role_id: "" });
      fetchTeamMembers();

    } catch (error: any) {
      console.error("Erro ao criar membro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível criar o membro da equipe."
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember || !editingRoleId) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role_id: editingRoleId })
        .eq('user_id', selectedMember.user_id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tipo de usuário atualizado com sucesso!"
      });

      setIsEditRoleDialogOpen(false);
      setSelectedMember(null);
      setEditingRoleId("");
      fetchTeamMembers();
      refetchPermissions();

    } catch (error: any) {
      console.error("Erro ao atualizar role:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível atualizar o tipo de usuário."
      });
    }
  };

  const handleDeleteMember = async (memberId: string, memberUserId: string, memberName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-team-member', {
        body: { user_id: memberUserId }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Sucesso",
        description: `${memberName} foi removido da equipe.`
      });

      fetchTeamMembers();

    } catch (error: any) {
      console.error("Erro ao remover membro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível remover o membro da equipe."
      });
    }
  };

  const openEditRoleDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setEditingRoleId(member.role?.id || "");
    setIsEditRoleDialogOpen(true);
  };

  // Filter roles for selection - exclude "Proprietário" from creating new members
  const availableRolesForCreate = roles.filter(r => r.name !== 'Proprietário');
  const availableRolesForEdit = roles;

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'Proprietário':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Gerente':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Corretor':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Assistente':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Equipe
            </CardTitle>
            <CardDescription>
              Adicione membros à sua equipe e defina suas permissões
            </CardDescription>
          </div>
          {canManageTeam && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Membro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Membro</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateMember} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="member_email">Email</Label>
                    <Input
                      id="member_email"
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="member_name">Nome Completo</Label>
                    <Input
                      id="member_name"
                      value={memberForm.full_name}
                      onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                      placeholder="Nome do membro"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="member_password">Senha</Label>
                    <Input
                      id="member_password"
                      type="password"
                      value={memberForm.password}
                      onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                      placeholder="Senha temporária (mín. 6 caracteres)"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      O membro poderá alterar a senha após o primeiro login
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="member_role">Tipo de Usuário</Label>
                    <Select
                      value={memberForm.role_id}
                      onValueChange={(value) => setMemberForm({ ...memberForm, role_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRolesForCreate.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex flex-col">
                              <span>{role.name}</span>
                              {role.description && (
                                <span className="text-xs text-muted-foreground">{role.description}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? "Criando..." : "Criar Membro"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum membro da equipe encontrado</p>
              <p className="text-sm">Adicione membros para compartilhar o acesso aos leads</p>
            </div>
          ) : (
            teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.full_name || "Nome não informado"}</p>
                      {member.user_id === user?.id && (
                        <Badge variant="outline">Você</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>ID: {member.user_id.substring(0, 8)}...</span>
                    </div>
                  </div>
                  {member.role && (
                    <Badge className={`ml-2 ${getRoleBadgeColor(member.role.name)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {member.role.name}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && member.user_id !== user?.id && member.role?.name !== 'Proprietário' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditRoleDialog(member)}
                      title="Editar tipo de usuário"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  {isOwner && member.user_id !== user?.id && member.role?.name !== 'Proprietário' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Remover membro">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {member.full_name} da equipe?
                            Esta ação não pode ser desfeita e o usuário perderá acesso ao sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteMember(member.id, member.user_id, member.full_name || "")}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Tipo de Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Alterando tipo de usuário de: <strong>{selectedMember?.full_name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Novo Tipo de Usuário</Label>
              <Select
                value={editingRoleId}
                onValueChange={setEditingRoleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesForEdit.filter(r => r.name !== 'Proprietário').map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex flex-col">
                        <span>{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditRoleDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateRole} disabled={!editingRoleId}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TeamManagement;
