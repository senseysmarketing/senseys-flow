import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, Building2, Upload, Download, FileSpreadsheet, 
  CheckCircle, AlertTriangle, XCircle, X, Loader2, 
  ChevronRight, AlertCircle, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { 
  downloadTemplate, 
  leadsTemplateColumns, 
  propertiesTemplateColumns 
} from "@/lib/import-templates";
import { 
  parseFile, 
  validateData, 
  normalizePhone, 
  normalizeTemperature,
  normalizePropertyType,
  normalizeTransactionType,
  type ValidationResult,
  type ParsedRow
} from "@/lib/csv-parser";

type ImportType = 'leads' | 'properties' | null;
type Step = 'select' | 'upload' | 'validate' | 'confirm';

const steps = [
  { id: 'select', label: 'Selecionar' },
  { id: 'upload', label: 'Upload' },
  { id: 'validate', label: 'Validar' },
  { id: 'confirm', label: 'Confirmar' },
];

const DataImporter = () => {
  const { account } = useAccount();
  const accountId = account?.id;
  const [step, setStep] = useState<Step>('select');
  const [importType, setImportType] = useState<ImportType>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStepIndex = steps.findIndex(s => s.id === step);

  const validCount = validationResults.filter(r => r.status === 'valid').length;
  const warningCount = validationResults.filter(r => r.status === 'warning').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['csv', 'xlsx', 'xls'];
    
    if (!extension || !validExtensions.includes(extension)) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "Use arquivos CSV ou Excel (.xlsx, .xls)"
      });
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    try {
      const data = await parseFile(selectedFile);
      setParsedData(data);
      
      if (importType) {
        const results = validateData(data, importType);
        setValidationResults(results);
      }
      
      setStep('validate');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTypeSelect = (type: ImportType) => {
    setImportType(type);
    setStep('upload');
  };

  const handleDownloadTemplate = () => {
    if (importType) {
      downloadTemplate(importType);
      toast({
        title: "Download iniciado",
        description: "O modelo de planilha foi baixado."
      });
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'upload':
        setStep('select');
        setImportType(null);
        break;
      case 'validate':
        setStep('upload');
        setFile(null);
        setParsedData([]);
        setValidationResults([]);
        break;
      case 'confirm':
        setStep('validate');
        break;
    }
  };

  const handleReset = () => {
    setStep('select');
    setImportType(null);
    setFile(null);
    setParsedData([]);
    setValidationResults([]);
  };

  const executeImport = async () => {
    if (!accountId || !importType) return;

    setIsImporting(true);
    
    const validRows = validationResults.filter(r => r.status !== 'error');
    const batchSize = 100;
    
    try {
      // Get default status for leads
      let defaultStatusId: string | null = null;
      if (importType === 'leads') {
        const { data: statusData } = await supabase
          .from('lead_status')
          .select('id')
          .eq('is_default', true)
          .single();
        defaultStatusId = statusData?.id || null;
      }

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        
        if (importType === 'leads') {
          const leadsToInsert = batch.map(r => ({
            account_id: accountId,
            name: r.data.nome?.trim() || 'Sem nome',
            phone: normalizePhone(r.data.telefone || ''),
            email: r.data.email?.trim() || null,
            interesse: r.data.interesse?.trim() || null,
            origem: r.data.origem?.trim() || 'Importação',
            campanha: r.data.campanha?.trim() || null,
            observacoes: r.data.observacoes?.trim() || null,
            temperature: normalizeTemperature(r.data.temperatura || ''),
            status_id: defaultStatusId,
          }));
          
          const { error } = await supabase.from('leads').insert(leadsToInsert);
          if (error) throw error;
          
        } else {
          const propertiesToInsert = batch.map(r => ({
            account_id: accountId,
            title: r.data.titulo?.trim() || 'Sem título',
            type: normalizePropertyType(r.data.tipo || 'apartamento'),
            transaction_type: normalizeTransactionType(r.data.transacao || 'venda'),
            address: r.data.endereco?.trim() || null,
            neighborhood: r.data.bairro?.trim() || null,
            city: r.data.cidade?.trim() || null,
            state: r.data.estado?.toUpperCase()?.trim() || null,
            zip_code: r.data.cep?.trim() || null,
            bedrooms: parseInt(r.data.quartos) || null,
            bathrooms: parseInt(r.data.banheiros) || null,
            parking_spots: parseInt(r.data.vagas) || null,
            area_m2: parseFloat(r.data.area_m2) || null,
            sale_price: parseFloat(r.data.preco_venda) || null,
            rent_price: parseFloat(r.data.preco_aluguel) || null,
            condo_fee: parseFloat(r.data.condominio) || null,
            iptu: parseFloat(r.data.iptu) || null,
            description: r.data.descricao?.trim() || null,
            reference_code: r.data.codigo_referencia?.trim() || null,
            status: 'available',
          }));
          
          const { error } = await supabase.from('properties').insert(propertiesToInsert);
          if (error) throw error;
        }
      }
      
      toast({
        title: "Importação concluída!",
        description: `${validRows.length} ${importType === 'leads' ? 'leads' : 'imóveis'} importados com sucesso.`,
      });
      
      handleReset();
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar os dados. Tente novamente.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const columns = importType === 'leads' ? leadsTemplateColumns : propertiesTemplateColumns;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              currentStepIndex >= i 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            )}>
              {currentStepIndex > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn(
              "ml-2 text-sm hidden sm:inline",
              currentStepIndex >= i ? "text-foreground" : "text-muted-foreground"
            )}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="mx-2 sm:mx-4 w-4 h-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Type */}
      {step === 'select' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">O que você deseja importar?</h2>
            <p className="text-muted-foreground">
              Selecione o tipo de dados que você deseja importar via planilha
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Card 
              className={cn(
                "cursor-pointer hover:border-primary transition-all hover:shadow-md",
                importType === 'leads' && "border-primary bg-primary/5"
              )}
              onClick={() => handleTypeSelect('leads')}
            >
              <CardHeader className="text-center pb-2">
                <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
                <CardTitle>Importar Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Importe contatos e leads de outras plataformas ou planilhas
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card 
              className={cn(
                "cursor-pointer hover:border-primary transition-all hover:shadow-md",
                importType === 'properties' && "border-primary bg-primary/5"
              )}
              onClick={() => handleTypeSelect('properties')}
            >
              <CardHeader className="text-center pb-2">
                <Building2 className="w-12 h-12 mx-auto mb-2 text-primary" />
                <CardTitle>Importar Imóveis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Importe sua carteira de imóveis de outra plataforma
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Upload File */}
      {step === 'upload' && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">
              Importar {importType === 'leads' ? 'Leads' : 'Imóveis'}
            </h2>
            <p className="text-muted-foreground">
              Faça upload da sua planilha ou baixe o modelo para preencher
            </p>
          </div>

          {/* Download template */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Modelo de planilha</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>Baixe o modelo e preencha com seus dados</span>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo
              </Button>
            </AlertDescription>
          </Alert>

          {/* Column info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campos disponíveis</CardTitle>
              <CardDescription>
                Campos obrigatórios estão marcados com *
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => (
                  <span 
                    key={col.key}
                    className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      col.required 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {col.label}{col.required && ' *'}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upload area */}
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {isParsing ? (
              <>
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-lg font-medium mb-2">Processando arquivo...</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Arraste seu arquivo aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: CSV, Excel (.xlsx, .xls)
                </p>
              </>
            )}
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              className="hidden"
              ref={fileInputRef}
            />
          </div>
        </div>
      )}

      {/* Step 3: Validate */}
      {step === 'validate' && (
        <div className="space-y-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">Validação dos Dados</h2>
              <p className="text-muted-foreground">
                {file?.name} • {parsedData.length} linhas encontradas
              </p>
            </div>
          </div>

          {/* Validation summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CardContent className="pt-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{validCount}</p>
                <p className="text-sm text-green-600 dark:text-green-400">Válidos</p>
              </CardContent>
            </Card>
            
            <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{warningCount}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Avisos</p>
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
              <CardContent className="pt-4 text-center">
                <XCircle className="w-8 h-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{errorCount}</p>
                <p className="text-sm text-red-600 dark:text-red-400">Erros</p>
              </CardContent>
            </Card>
          </div>

          {/* Data preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview dos Dados</CardTitle>
              <CardDescription>
                Revise os dados antes de importar. Linhas com erro serão ignoradas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 sticky left-0 bg-background">Linha</TableHead>
                      <TableHead className="w-16">Status</TableHead>
                      {columns.slice(0, 5).map(col => (
                        <TableHead key={col.key} className="min-w-[120px]">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.map((row, i) => (
                      <TableRow 
                        key={i}
                        className={cn(
                          row.status === 'error' && "bg-red-50 dark:bg-red-950/20",
                          row.status === 'warning' && "bg-yellow-50 dark:bg-yellow-950/20"
                        )}
                      >
                        <TableCell className="font-mono text-xs sticky left-0 bg-inherit">
                          {i + 2}
                        </TableCell>
                        <TableCell>
                          {row.status === 'valid' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {row.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                          {row.status === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
                        </TableCell>
                        {columns.slice(0, 5).map(col => (
                          <TableCell key={col.key} className="text-sm truncate max-w-[200px]">
                            {row.data[col.key] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Error details */}
          {errorCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erros encontrados ({errorCount})</AlertTitle>
              <AlertDescription>
                <ScrollArea className="h-[100px] mt-2">
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {validationResults
                      .filter(r => r.status === 'error')
                      .slice(0, 10)
                      .map((r, i) => (
                        <li key={i}>
                          Linha {r.rowIndex + 2}: {r.errors.join(', ')}
                        </li>
                      ))}
                    {errorCount > 10 && (
                      <li className="text-muted-foreground">
                        ... e mais {errorCount - 10} erros
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setStep('confirm')} 
              disabled={validCount === 0}
            >
              Continuar com {validCount + warningCount} registros
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-6 max-w-xl mx-auto">
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold mb-2">Pronto para Importar</h2>
            <p className="text-muted-foreground">
              {validCount + warningCount} {importType === 'leads' ? 'leads' : 'imóveis'} serão importados
            </p>
            {warningCount > 0 && (
              <p className="text-yellow-600 text-sm mt-2">
                {warningCount} registros com avisos serão importados com valores padrão
              </p>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              {importType === 'leads' 
                ? 'Os leads serão criados com o status padrão configurado e ficarão sem corretor atribuído. Você pode atribuí-los manualmente depois.'
                : 'Os imóveis serão criados com status "Disponível". Você pode editar os detalhes depois.'}
            </AlertDescription>
          </Alert>

          <div className="flex justify-center gap-4 pt-4">
            <Button variant="outline" onClick={() => setStep('validate')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={executeImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirmar Importação
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImporter;
