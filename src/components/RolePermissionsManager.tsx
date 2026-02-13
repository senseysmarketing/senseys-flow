import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, FileText, Settings, Calendar, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface RolePermissionState {
  [roleId: string]: {
    [permissionId: string]: boolean;
  };
}

const categoryIcons: { [key: string]: React.ReactNode } = {
  leads: <Users className="h-4 w-4" />,
  reports: <BarChart3 className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  conversations: <FileText className="h-4 w-4" />,
};

const categoryLabels: { [key: string]: string } = {
  leads: "Leads",
  reports: "Relatórios",
  team: "Equipe",
  settings: "Configurações",
  calendar: "Agenda",
  conversations: "Conversas",
};

const RolePermissionsManager = () => {
  const { roles, allPermissions, hasPermission, isOwner, refetch } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionState>({});

  const canManage = hasPermission('settings.manage');

  useEffect(() => {
    if (roles.length > 0 && allPermissions.length > 0) {
      fetchRolePermissions();
    }
  }, [roles, allPermissions]);

  const fetchRolePermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id, granted');

      if (error) throw error;

      const state: RolePermissionState = {};
      roles.forEach(role => {
        state[role.id] = {};
        allPermissions.forEach(perm => {
          const rp = data?.find(d => d.role_id === role.id && d.permission_id === perm.id);
          state[role.id][perm.id] = rp?.granted ?? false;
        });
      });

      setRolePermissions(state);
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = async (roleId: string, permissionId: string, granted: boolean) => {
    if (!canManage) return;

    // Find the role
    const role = roles.find(r => r.id === roleId);
    if (role?.name === 'Proprietário') {
      toast({
        variant: "destructive",
        title: "Não permitido",
        description: "As permissões do Proprietário não podem ser alteradas."
      });
      return;
    }

    setSaving(true);
    
    // Optimistic update
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionId]: granted
      }
    }));

    try {
      // Upsert the role_permission
      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          role_id: roleId,
          permission_id: permissionId,
          granted
        }, {
          onConflict: 'role_id,permission_id'
        });

      if (error) throw error;

      // Refetch permissions context
      await refetch();

    } catch (error: any) {
      console.error('Erro ao atualizar permissão:', error);
      
      // Revert optimistic update
      setRolePermissions(prev => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [permissionId]: !granted
        }
      }));

      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar a permissão."
      });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const permissionsByCategory = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as { [category: string]: Permission[] });

  // Filter out Proprietário from display (always has all permissions)
  const editableRoles = roles.filter(r => r.name !== 'Proprietário');

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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissões por Tipo de Usuário
        </CardTitle>
        <CardDescription>
          Configure as permissões de cada tipo de usuário. O Proprietário sempre tem acesso total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Permissão</th>
                {editableRoles.map(role => (
                  <th key={role.id} className="text-center py-3 px-4 font-medium">
                    <Badge variant="outline" className="whitespace-nowrap">
                      {role.name}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <>
                  <tr key={`category-${category}`} className="bg-muted/30">
                    <td colSpan={editableRoles.length + 1} className="py-2 px-2">
                      <div className="flex items-center gap-2 font-medium text-sm">
                        {categoryIcons[category]}
                        {categoryLabels[category] || category}
                      </div>
                    </td>
                  </tr>
                  {perms.map(permission => (
                    <tr key={permission.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{permission.name}</p>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          )}
                        </div>
                      </td>
                      {editableRoles.map(role => (
                        <td key={`${role.id}-${permission.id}`} className="text-center py-3 px-4">
                          <Checkbox
                            checked={rolePermissions[role.id]?.[permission.id] ?? false}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(role.id, permission.id, checked === true)
                            }
                            disabled={!canManage || saving}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
        
        {!canManage && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Você não tem permissão para alterar as configurações de permissões.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RolePermissionsManager;
