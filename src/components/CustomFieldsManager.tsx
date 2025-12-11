import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Move, Copy, Check, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface CustomField {
  id: string;
  field_key: string;
  name: string;
  field_type: string;
  options: string[] | null;
  placeholder: string | null;
  position: number;
  is_required: boolean;
  is_active: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Seleção' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'date', label: 'Data' },
];

const generateFieldKey = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
};

const CustomFieldsManager = () => {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fieldForm, setFieldForm] = useState({
    name: "",
    field_key: "",
    field_type: "text",
    placeholder: "",
    is_required: false,
    options: ""
  });

  useEffect(() => {
    fetchCustomFields();
  }, []);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      
      const fieldsWithOptions = (data || []).map(field => ({
        ...field,
        options: field.options as string[] | null
      }));
      
      setCustomFields(fieldsWithOptions);
    } catch (error) {
      console.error("Erro ao buscar campos:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os campos personalizados."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFieldForm(prev => ({
      ...prev,
      name,
      field_key: editingField ? prev.field_key : generateFieldKey(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fieldForm.name.trim() || !fieldForm.field_key.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nome e chave do campo são obrigatórios."
      });
      return;
    }

    try {
      const { data: accountData, error: accountError } = await supabase.rpc('get_user_account_id');
      if (accountError) throw accountError;

      const options = fieldForm.field_type === 'select' && fieldForm.options.trim()
        ? fieldForm.options.split(',').map(o => o.trim()).filter(o => o)
        : null;

      if (editingField) {
        const { error } = await supabase
          .from("custom_fields")
          .update({
            name: fieldForm.name,
            field_type: fieldForm.field_type,
            placeholder: fieldForm.placeholder || null,
            is_required: fieldForm.is_required,
            options
          })
          .eq("id", editingField.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Campo atualizado com sucesso!" });
      } else {
        const maxPosition = Math.max(...customFields.map(f => f.position), -1);
        
        const { error } = await supabase
          .from("custom_fields")
          .insert([{
            account_id: accountData,
            name: fieldForm.name,
            field_key: fieldForm.field_key,
            field_type: fieldForm.field_type,
            placeholder: fieldForm.placeholder || null,
            is_required: fieldForm.is_required,
            position: maxPosition + 1,
            is_active: true,
            options
          }]);

        if (error) {
          if (error.code === '23505') {
            toast({
              variant: "destructive",
              title: "Erro",
              description: "Já existe um campo com essa chave."
            });
            return;
          }
          throw error;
        }
        toast({ title: "Sucesso", description: "Campo criado com sucesso!" });
      }

      setIsDialogOpen(false);
      setEditingField(null);
      setFieldForm({ name: "", field_key: "", field_type: "text", placeholder: "", is_required: false, options: "" });
      fetchCustomFields();
    } catch (error) {
      console.error("Erro ao salvar campo:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar o campo."
      });
    }
  };

  const handleDelete = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from("custom_fields")
        .delete()
        .eq("id", fieldId);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Campo removido com sucesso!" });
      fetchCustomFields();
    } catch (error) {
      console.error("Erro ao remover campo:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover o campo."
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(customFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index
    }));

    setCustomFields(updatedItems);

    try {
      const updates = updatedItems.map(item =>
        supabase.from("custom_fields").update({ position: item.position }).eq("id", item.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
      fetchCustomFields();
    }
  };

  const openEditDialog = (field: CustomField) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      field_key: field.field_key,
      field_type: field.field_type,
      placeholder: field.placeholder || "",
      is_required: field.is_required,
      options: field.options?.join(', ') || ""
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingField(null);
    setFieldForm({ name: "", field_key: "", field_type: "text", placeholder: "", is_required: false, options: "" });
    setIsDialogOpen(true);
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getFieldTypeLabel = (type: string) => {
    return FIELD_TYPES.find(t => t.value === type)?.label || type;
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
            <CardTitle>Campos Personalizados</CardTitle>
            <CardDescription>
              Crie campos personalizados para capturar informações adicionais dos leads via webhook.
              <span className="block mt-1 text-xs">
                💡 Leads do Meta Ads já importam as perguntas do formulário automaticamente.
              </span>
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Campo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {customFields.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum campo personalizado criado ainda.</p>
            <p className="text-sm mt-1">Clique em "Novo Campo" para começar.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="custom-fields">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {customFields.map((field, index) => (
                    <Draggable key={field.id} draggableId={field.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors ${
                            snapshot.isDragging ? 'shadow-lg border-primary' : ''
                          }`}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{field.name}</span>
                              {field.is_required && (
                                <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {getFieldTypeLabel(field.field_type)}
                              </Badge>
                              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                {field.field_key}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => copyToClipboard(field.field_key)}
                              >
                                {copiedKey === field.field_key ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(field)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação irá remover o campo "{field.name}" e todos os valores associados aos leads. Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(field.id)}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* Documentação do Webhook */}
        {customFields.length > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2">Uso no Webhook</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Envie os campos personalizados no corpo da requisição usando o objeto <code className="bg-muted px-1 rounded">custom_fields</code>:
            </p>
            <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "name": "Nome do Lead",
  "phone": "11999999999",
  "custom_fields": {
${customFields.map(f => `    "${f.field_key}": "valor"`).join(',\n')}
  }
}`}
            </pre>
          </div>
        )}
      </CardContent>

      {/* Dialog de criação/edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Editar Campo' : 'Novo Campo Personalizado'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Campo</Label>
              <Input
                id="name"
                value={fieldForm.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Valor de Investimento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field_key">Chave do Campo (para webhook)</Label>
              <Input
                id="field_key"
                value={fieldForm.field_key}
                onChange={(e) => setFieldForm({ ...fieldForm, field_key: e.target.value })}
                placeholder="Ex: valor_investimento"
                disabled={!!editingField}
                className={editingField ? "bg-muted" : ""}
              />
              {!editingField && (
                <p className="text-xs text-muted-foreground">
                  A chave é gerada automaticamente, mas pode ser editada.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="field_type">Tipo do Campo</Label>
              <Select
                value={fieldForm.field_type}
                onValueChange={(value) => setFieldForm({ ...fieldForm, field_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fieldForm.field_type === 'select' && (
              <div className="space-y-2">
                <Label htmlFor="options">Opções (separadas por vírgula)</Label>
                <Input
                  id="options"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                  placeholder="Ex: Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="placeholder">Placeholder (opcional)</Label>
              <Input
                id="placeholder"
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                placeholder="Texto de exemplo para o campo"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_required"
                checked={fieldForm.is_required}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, is_required: checked })}
              />
              <Label htmlFor="is_required">Campo obrigatório</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingField ? 'Salvar' : 'Criar Campo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CustomFieldsManager;
