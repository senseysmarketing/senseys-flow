import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  data: ParsedRow;
  rowIndex: number;
}

// Parse CSV or Excel file
export const parseFile = async (file: File): Promise<ParsedRow[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  }
  
  throw new Error('Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)');
};

const parseCSV = (file: File): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error('O arquivo precisa ter pelo menos uma linha de cabeçalho e uma linha de dados'));
          return;
        }
        
        // Parse header
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        
        // Parse data rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: ParsedRow = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          rows.push(row);
        }
        
        resolve(rows);
      } catch (error) {
        reject(new Error('Erro ao processar o arquivo CSV'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
};

// Handle CSV fields with quotes and commas
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
};

const parseExcel = async (file: File): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        if (jsonData.length < 2) {
          reject(new Error('O arquivo precisa ter pelo menos uma linha de cabeçalho e uma linha de dados'));
          return;
        }
        
        const headers = (jsonData[0] as string[]).map(h => String(h || '').toLowerCase().trim());
        
        const rows: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const values = jsonData[i] as string[];
          if (!values || values.every(v => !v)) continue; // Skip empty rows
          
          const row: ParsedRow = {};
          headers.forEach((header, index) => {
            row[header] = String(values[index] ?? '').trim();
          });
          rows.push(row);
        }
        
        resolve(rows);
      } catch (error) {
        reject(new Error('Erro ao processar o arquivo Excel'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    reader.readAsArrayBuffer(file);
  });
};

// Validation helpers
export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

export const normalizeTemperature = (temp: string): string => {
  const normalized = temp?.toLowerCase()?.trim();
  
  const mapping: Record<string, string> = {
    'hot': 'hot',
    'quente': 'hot',
    'warm': 'warm',
    'morno': 'warm',
    'cold': 'cold',
    'frio': 'cold',
  };
  
  return mapping[normalized] || 'warm';
};

export const normalizePropertyType = (type: string): string => {
  const normalized = type?.toLowerCase()?.trim();
  
  const mapping: Record<string, string> = {
    'apartamento': 'apartamento',
    'apt': 'apartamento',
    'casa': 'casa',
    'terreno': 'terreno',
    'lote': 'terreno',
    'comercial': 'comercial',
    'sala': 'sala',
    'galpao': 'galpão',
    'galpão': 'galpão',
    'fazenda': 'fazenda',
    'sitio': 'sítio',
    'sítio': 'sítio',
  };
  
  return mapping[normalized] || normalized;
};

export const normalizeTransactionType = (type: string): string => {
  const normalized = type?.toLowerCase()?.trim();
  
  const mapping: Record<string, string> = {
    'venda': 'venda',
    'aluguel': 'aluguel',
    'locacao': 'aluguel',
    'locação': 'aluguel',
    'venda_aluguel': 'venda_aluguel',
    'venda e aluguel': 'venda_aluguel',
    'ambos': 'venda_aluguel',
  };
  
  return mapping[normalized] || normalized;
};

// Validate lead row
export const validateLeadRow = (row: ParsedRow, rowIndex: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!row.nome?.trim()) {
    errors.push("Nome é obrigatório");
  }
  
  if (!row.telefone?.trim()) {
    errors.push("Telefone é obrigatório");
  } else if (!isValidPhone(row.telefone)) {
    errors.push("Formato de telefone inválido (mínimo 10 dígitos)");
  }

  // Optional validations
  if (row.email && !isValidEmail(row.email)) {
    warnings.push("Email com formato inválido");
  }

  if (row.temperatura) {
    const validTemps = ['hot', 'warm', 'cold', 'quente', 'morno', 'frio'];
    if (!validTemps.includes(row.temperatura.toLowerCase())) {
      warnings.push("Temperatura inválida, será definida como 'morno'");
    }
  }

  return {
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    errors,
    warnings,
    data: row,
    rowIndex
  };
};

// Validate property row
export const validatePropertyRow = (row: ParsedRow, rowIndex: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!row.titulo?.trim()) {
    errors.push("Título é obrigatório");
  }
  
  if (!row.tipo?.trim()) {
    errors.push("Tipo é obrigatório");
  } else {
    const validTypes = ['apartamento', 'apt', 'casa', 'terreno', 'lote', 'comercial', 'sala', 'galpao', 'galpão', 'fazenda', 'sitio', 'sítio'];
    if (!validTypes.includes(row.tipo.toLowerCase())) {
      errors.push("Tipo de imóvel inválido");
    }
  }
  
  if (!row.transacao?.trim()) {
    errors.push("Tipo de transação é obrigatório");
  } else {
    const validTransactions = ['venda', 'aluguel', 'locacao', 'locação', 'venda_aluguel', 'venda e aluguel', 'ambos'];
    if (!validTransactions.includes(row.transacao.toLowerCase())) {
      errors.push("Tipo de transação inválido (use: venda, aluguel ou venda_aluguel)");
    }
  }

  // Numeric validations
  const numericFields = ['quartos', 'banheiros', 'vagas', 'area_m2', 'preco_venda', 'preco_aluguel', 'condominio', 'iptu'];
  numericFields.forEach(field => {
    if (row[field] && isNaN(parseFloat(row[field]))) {
      warnings.push(`${field} deve ser um número, será ignorado`);
    }
  });

  // State validation
  if (row.estado && row.estado.length !== 2) {
    warnings.push("Estado deve ter 2 letras (UF)");
  }

  return {
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    errors,
    warnings,
    data: row,
    rowIndex
  };
};

// Validate all rows
export const validateData = (
  rows: ParsedRow[], 
  type: 'leads' | 'properties'
): ValidationResult[] => {
  const validator = type === 'leads' ? validateLeadRow : validatePropertyRow;
  return rows.map((row, index) => validator(row, index));
};
