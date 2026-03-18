import * as XLSX from 'xlsx';

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interesse?: string;
  observacoes?: string;
  origem?: string;
  campanha?: string;
  conjunto?: string;
  anuncio?: string;
  created_at: string;
  updated_at: string;
  status_id?: string;
  temperature?: string | null;
  assigned_broker_id?: string | null;
  lead_status?: {
    name: string;
    color: string;
  };
  properties?: {
    id: string;
    title: string;
  } | null;
  broker?: {
    full_name: string | null;
  } | null;
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const temperatureLabel = (temp: string | null | undefined) => {
  switch (temp) {
    case "hot": return "Quente";
    case "warm": return "Morno";
    case "cold": return "Frio";
    default: return "Morno";
  }
};

export const exportLeadsToExcel = (leads: Lead[]) => {
  const rows = leads.map((lead) => ({
    "Nome": lead.name,
    "Telefone": formatPhone(lead.phone),
    "Email": lead.email || "",
    "Status": lead.lead_status?.name || "",
    "Temperatura": temperatureLabel(lead.temperature),
    "Corretor": (lead.broker as any)?.full_name || "",
    "Origem": lead.origem || "",
    "Interesse": lead.interesse || "",
    "Imóvel": lead.properties?.title || "",
    "Campanha": lead.campanha || "",
    "Conjunto": lead.conjunto || "",
    "Anúncio": lead.anuncio || "",
    "Observações": (lead.observacoes || "").replace(/[\n\r]+/g, " "),
    "Criado em": formatDate(lead.created_at),
    "Atualizado em": formatDate(lead.updated_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const headers = Object.keys(rows[0] || {});
  worksheet['!cols'] = headers.map((header) => {
    const maxLen = Math.max(
      header.length,
      ...rows.map((row) => String((row as any)[header] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  // Force phone column as text
  const phoneColIndex = headers.indexOf("Telefone");
  if (phoneColIndex >= 0) {
    for (let i = 0; i < rows.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: phoneColIndex });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = 's';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-").slice(0, 5);
  const filename = `leads_${dateStr}_${timeStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
};

// Keep CSV as legacy fallback
export const exportLeadsToCSV = (leads: Lead[], filename?: string) => {
  const headers = [
    "Nome", "Telefone", "Email", "Status", "Temperatura",
    "Origem", "Interesse", "Imóvel", "Campanha", "Conjunto",
    "Anúncio", "Observações", "Criado em", "Atualizado em",
  ];

  const rows = leads.map((lead) => [
    lead.name, formatPhone(lead.phone), lead.email || "",
    lead.lead_status?.name || "", temperatureLabel(lead.temperature),
    lead.origem || "", lead.interesse || "",
    lead.properties?.title || "", lead.campanha || "",
    lead.conjunto || "", lead.anuncio || "",
    (lead.observacoes || "").replace(/[\n\r]+/g, " "),
    formatDate(lead.created_at), formatDate(lead.updated_at),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const defaultFilename = `leads_${dateStr}_${timeStr}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", filename || defaultFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default exportLeadsToExcel;
