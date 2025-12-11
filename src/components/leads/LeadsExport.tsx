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
  lead_status?: {
    name: string;
    color: string;
  };
  properties?: {
    id: string;
    title: string;
  } | null;
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
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
    case "hot":
      return "Quente";
    case "warm":
      return "Morno";
    case "cold":
      return "Frio";
    default:
      return "Morno";
  }
};

export const exportLeadsToCSV = (leads: Lead[], filename?: string) => {
  const headers = [
    "Nome",
    "Telefone",
    "Email",
    "Status",
    "Temperatura",
    "Origem",
    "Interesse",
    "Imóvel",
    "Campanha",
    "Conjunto",
    "Anúncio",
    "Observações",
    "Criado em",
    "Atualizado em",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    formatPhone(lead.phone),
    lead.email || "",
    lead.lead_status?.name || "",
    temperatureLabel(lead.temperature),
    lead.origem || "",
    lead.interesse || "",
    lead.properties?.title || "",
    lead.campanha || "",
    lead.conjunto || "",
    lead.anuncio || "",
    (lead.observacoes || "").replace(/[\n\r]+/g, " "),
    formatDate(lead.created_at),
    formatDate(lead.updated_at),
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

export default exportLeadsToCSV;
