import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Info, ArrowLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WhatsAppTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesChange: () => void;
}

interface Template {
  id: string;
  name: string;
  template: string;
  position: number;
}

interface FormVar {
  code: string;
  label: string;
}

const TEMPLATE_VARIABLES = [
  { code: '{nome}', label: 'Nome do lead', example: 'João Silva' },
  { code: '{email}', label: 'Email do lead', example: 'joao@email.com' },
  { code: '{telefone}', label: 'Telefone do lead', example: '(11) 99999-9999' },
  { code: '{imovel}', label: 'Imóvel vinculado', example: 'Apartamento Centro' },
  { code: '{corretor}', label: 'Corretor responsável', example: 'Maria Santos' },
  { code: '{empresa}', label: 'Nome da empresa', example: 'Imobiliária ABC' },
];

export function WhatsAppTemplatesModal({ open, onOpenChange, onTemplatesChange }: WhatsAppTemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [formVars, setFormVars] = useState<FormVar[]>([]);
  const [showMoreVars, setShowMoreVars] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formTemplate, setFormTemplate] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('id, name, template, position')
      .eq('is_active', true)
      .order('position');
    
    setTemplates(data || []);
    setLoading(false);
  };

  const fetchFormVars = async () => {
    // Get distinct question_name + question_label from meta_form_scoring_rules via meta_form_configs
    const { data } = await supabase
      .from('meta_form_scoring_rules')
      .select('question_name, question_label');
    
    if (!data || data.length === 0) return;

    // Deduplicate by question_name
    const seen = new Set<string>();
    const vars: FormVar[] = [];
    for (const row of data) {
      if (!seen.has(row.question_name)) {
        seen.add(row.question_name);
        const label = row.question_label || row.question_name;
        // Generate variable code: {form_<question_name>} keeping the name as-is
        vars.push({
          code: `{form_${row.question_name}}`,
          label,
        });
      }
    }
    setFormVars(vars);
  };

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchFormVars();
    }
  }, [open]);

  const resetForm = () => {
    setFormName('');
    setFormTemplate('');
    setEditingTemplate(null);
    setIsCreating(false);
    setShowMoreVars(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const startCreate = () => {
    setFormName('');
    setFormTemplate('');
    setEditingTemplate(null);
    setIsCreating(true);
    setShowMoreVars(false);
  };

  const startEdit = (template: Template) => {
    setFormName(template.name);
    setFormTemplate(template.template);
    setEditingTemplate(template);
    setIsCreating(true);
    setShowMoreVars(false);
  };

  const insertVariable = (code: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormTemplate(prev => prev + code);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = formTemplate.substring(0, start) + code + formTemplate.substring(end);
    setFormTemplate(newValue);
    
    // Focus and set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + code.length, start + code.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTemplate.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e a mensagem do template.',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: accountData } = await supabase.rpc('get_user_account_id');
      
      if (editingTemplate) {
        await supabase
          .from('whatsapp_templates')
          .update({ 
            name: formName.trim(), 
            template: formTemplate.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);
        
        toast({ title: 'Template atualizado!' });
      } else {
        const maxPosition = templates.length > 0 
          ? Math.max(...templates.map(t => t.position)) + 1 
          : 0;
        
        await supabase.from('whatsapp_templates').insert({
          account_id: accountData,
          name: formName.trim(),
          template: formTemplate.trim(),
          position: maxPosition,
          is_active: true,
        });
        
        toast({ title: 'Template criado!' });
      }

      resetForm();
      fetchTemplates();
      onTemplatesChange();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar o template.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      await supabase
        .from('whatsapp_templates')
        .update({ is_active: false })
        .eq('id', deleteTarget.id);
      
      toast({ title: 'Template excluído!' });
      setDeleteTarget(null);
      fetchTemplates();
      onTemplatesChange();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o template.',
      });
    }
  };

  const getPreviewText = (text: string) => {
    let preview = text;
    TEMPLATE_VARIABLES.forEach(v => {
      preview = preview.replace(new RegExp(v.code.replace(/[{}]/g, '\\$&'), 'g'), v.example);
    });
    // Replace form vars with placeholder example
    formVars.forEach(v => {
      preview = preview.replace(new RegExp(v.code.replace(/[{}?]/g, (c) => `\\${c}`), 'g'), `[${v.label}]`);
    });
    return preview;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreating && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={resetForm}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {isCreating 
                ? (editingTemplate ? 'Editar Template' : 'Novo Template')
                : 'Gerenciar Templates de Mensagem'
              }
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isCreating ? (
            /* Form View */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  placeholder="Ex: Bom dia, Boas vindas..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-message">Mensagem</Label>
                <Textarea
                  id="template-message"
                  ref={textareaRef}
                  placeholder="Olá {nome}! Obrigado pelo interesse..."
                  value={formTemplate}
                  onChange={(e) => setFormTemplate(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Clique para inserir variáveis:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <Badge
                      key={v.code}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => insertVariable(v.code)}
                    >
                      {v.code}
                    </Badge>
                  ))}
                </div>

                {/* Form vars in editor - collapsible */}
                {formVars.length > 0 && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowMoreVars(!showMoreVars)}
                    >
                      {showMoreVars ? (
                        <><ChevronUp className="h-3 w-3 mr-1" />Ocultar variáveis de formulário</>
                      ) : (
                        <><ChevronDown className="h-3 w-3 mr-1" />Mostrar variáveis de formulário Meta ({formVars.length})</>
                      )}
                    </Button>
                    {showMoreVars && (
                      <div className="flex flex-wrap gap-2 mt-2 p-2 bg-muted/40 rounded-md border border-dashed">
                        {formVars.map((v) => (
                          <Badge
                            key={v.code}
                            variant="outline"
                            className="cursor-pointer hover:bg-accent transition-colors border-primary/40 text-primary"
                            onClick={() => insertVariable(v.code)}
                            title={v.label}
                          >
                            {v.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formTemplate && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Preview da mensagem:
                  </Label>
                  <p className="text-sm whitespace-pre-wrap">
                    {getPreviewText(formTemplate)}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            /* List View */
            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-4 pr-1">
                <Button onClick={startCreate} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>

                <div className="space-y-2">
                  {templates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum template criado ainda.
                    </div>
                  ) : (
                    templates.map((template) => (
                      <Card key={template.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{template.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {template.template}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEdit(template)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(template)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Variables Reference */}
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Variáveis Disponíveis
                  </Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <div key={v.code} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="font-mono text-xs">
                          {v.code}
                        </Badge>
                        <span className="text-muted-foreground truncate">{v.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Form vars section in list view */}
                  {formVars.length > 0 && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground gap-1"
                        onClick={() => setShowMoreVars(!showMoreVars)}
                      >
                        {showMoreVars ? (
                          <><ChevronUp className="h-3 w-3" />Ocultar variáveis de formulário</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" />Mostrar mais variáveis ({formVars.length} de formulário Meta)</>
                        )}
                      </Button>
                      {showMoreVars && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-dashed">
                          {formVars.map((v) => (
                            <div key={v.code} className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                                {v.code}
                              </Badge>
                              <span className="text-muted-foreground truncate">{v.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{deleteTarget?.name}" será excluído. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
