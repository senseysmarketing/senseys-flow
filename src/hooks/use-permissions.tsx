import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface RolePermission {
  permission_key: string;
  granted: boolean;
}

interface PermissionsContextType {
  permissions: RolePermission[];
  userRole: Role | null;
  roles: Role[];
  allPermissions: Permission[];
  loading: boolean;
  hasPermission: (permissionKey: string) => boolean;
  isOwner: boolean;
  refetch: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  userRole: null,
  roles: [],
  allPermissions: [],
  loading: true,
  hasPermission: () => false,
  isOwner: false,
  refetch: async () => {},
});

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return context;
};

interface PermissionsProviderProps {
  children: ReactNode;
}

export const PermissionsProvider = ({ children }: PermissionsProviderProps) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setUserRole(null);
      setRoles([]);
      setAllPermissions([]);
      setIsOwner(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch user's role
      const { data: userRoleData, error: userRoleError } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (
            id,
            name,
            description,
            is_system
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (userRoleError) {
        console.error('Error fetching user role:', userRoleError);
      }

      const role = userRoleData?.roles as unknown as Role | null;
      setUserRole(role);
      setIsOwner(role?.name === 'Proprietário' && role?.is_system === true);

      // Fetch all permissions for the user's role
      if (role) {
        const { data: rolePermissions, error: rpError } = await supabase
          .from('role_permissions')
          .select(`
            granted,
            permissions (
              key
            )
          `)
          .eq('role_id', role.id);

        if (rpError) {
          console.error('Error fetching role permissions:', rpError);
        } else {
          const perms = rolePermissions?.map((rp: any) => ({
            permission_key: rp.permissions?.key,
            granted: rp.granted
          })).filter((p: any) => p.permission_key) || [];
          setPermissions(perms);
        }
      }

      // Fetch all roles for the account
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else {
        setRoles(rolesData || []);
      }

      // Fetch all permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true });

      if (permissionsError) {
        console.error('Error fetching permissions:', permissionsError);
      } else {
        setAllPermissions(permissionsData || []);
      }

    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permissionKey: string): boolean => {
    // Owner has all permissions
    if (isOwner) return true;
    
    const perm = permissions.find(p => p.permission_key === permissionKey);
    return perm?.granted ?? false;
  }, [permissions, isOwner]);

  return (
    <PermissionsContext.Provider value={{ 
      permissions, 
      userRole, 
      roles, 
      allPermissions, 
      loading, 
      hasPermission, 
      isOwner,
      refetch: fetchPermissions 
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};
