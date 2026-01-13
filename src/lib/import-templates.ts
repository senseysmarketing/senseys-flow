// Template definitions for data import

export interface TemplateColumn {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
}

export const leadsTemplateColumns: TemplateColumn[] = [
  { key: 'nome', label: 'Nome', required: true, description: 'Nome completo do lead', example: 'João Silva' },
  { key: 'telefone', label: 'Telefone', required: true, description: 'Telefone com DDD', example: '11999998888' },
  { key: 'email', label: 'Email', required: false, description: 'Email do lead', example: 'joao@email.com' },
  { key: 'interesse', label: 'Interesse', required: false, description: 'Interesse do lead', example: 'Apartamento 3 quartos' },
  { key: 'origem', label: 'Origem', required: false, description: 'Origem do lead', example: 'Site' },
  { key: 'campanha', label: 'Campanha', required: false, description: 'Nome da campanha', example: 'Facebook Ads Junho' },
  { key: 'observacoes', label: 'Observações', required: false, description: 'Observações gerais', example: 'Cliente VIP' },
  { key: 'temperatura', label: 'Temperatura', required: false, description: 'hot, warm ou cold', example: 'warm' },
];

export const propertiesTemplateColumns: TemplateColumn[] = [
  { key: 'titulo', label: 'Título', required: true, description: 'Título do imóvel', example: 'Apartamento Centro' },
  { key: 'tipo', label: 'Tipo', required: true, description: 'apartamento, casa, terreno, comercial, sala, galpao', example: 'apartamento' },
  { key: 'transacao', label: 'Transação', required: true, description: 'venda, aluguel ou venda_aluguel', example: 'venda' },
  { key: 'endereco', label: 'Endereço', required: false, description: 'Endereço completo', example: 'Rua das Flores, 123' },
  { key: 'bairro', label: 'Bairro', required: false, description: 'Bairro', example: 'Centro' },
  { key: 'cidade', label: 'Cidade', required: false, description: 'Cidade', example: 'São Paulo' },
  { key: 'estado', label: 'Estado', required: false, description: 'UF (2 letras)', example: 'SP' },
  { key: 'cep', label: 'CEP', required: false, description: 'CEP', example: '01234-567' },
  { key: 'quartos', label: 'Quartos', required: false, description: 'Número de quartos', example: '3' },
  { key: 'banheiros', label: 'Banheiros', required: false, description: 'Número de banheiros', example: '2' },
  { key: 'vagas', label: 'Vagas', required: false, description: 'Vagas de garagem', example: '2' },
  { key: 'area_m2', label: 'Área (m²)', required: false, description: 'Área em metros quadrados', example: '120' },
  { key: 'preco_venda', label: 'Preço Venda', required: false, description: 'Preço de venda', example: '500000' },
  { key: 'preco_aluguel', label: 'Preço Aluguel', required: false, description: 'Preço de aluguel', example: '2500' },
  { key: 'condominio', label: 'Condomínio', required: false, description: 'Valor do condomínio', example: '800' },
  { key: 'iptu', label: 'IPTU', required: false, description: 'Valor do IPTU', example: '300' },
  { key: 'descricao', label: 'Descrição', required: false, description: 'Descrição do imóvel', example: 'Apartamento reformado com vista' },
  { key: 'codigo_referencia', label: 'Código Referência', required: false, description: 'Código interno', example: 'APT-001' },
];

export const generateCSVTemplate = (columns: TemplateColumn[]): string => {
  const headers = columns.map(col => col.key).join(',');
  const examples = columns.map(col => `"${col.example}"`).join(',');
  return `${headers}\n${examples}`;
};

export const downloadTemplate = (type: 'leads' | 'properties') => {
  const columns = type === 'leads' ? leadsTemplateColumns : propertiesTemplateColumns;
  const csv = generateCSVTemplate(columns);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `modelo-${type === 'leads' ? 'leads' : 'imoveis'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
