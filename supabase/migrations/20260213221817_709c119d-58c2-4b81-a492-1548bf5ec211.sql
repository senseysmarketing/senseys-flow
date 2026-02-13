
-- 1. Insert the new permission
INSERT INTO public.permissions (key, name, description, category)
VALUES ('conversations.view', 'Ver conversas', 'Permite acessar a tela de conversas do WhatsApp', 'conversations')
ON CONFLICT (key) DO NOTHING;

-- 2. Grant conversations.view to all existing Owner and Manager roles
INSERT INTO public.role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.key = 'conversations.view'
  AND r.name IN ('Proprietário', 'Gerente')
ON CONFLICT (role_id, permission_id) DO NOTHING;
