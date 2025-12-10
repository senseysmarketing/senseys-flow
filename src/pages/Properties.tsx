import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Building2, MapPin, Bed, Car, Bath, Search, Filter, Eye } from "lucide-react";
import { PropertyDetailModal } from "@/components/PropertyDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Property {
  id: string;
  title: string;
  type: string;
  transaction_type: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sale_price: number | null;
  rent_price: number | null;
  status: string;
  description: string | null;
  assigned_broker_id: string | null;
  campaign_cost: number | null;
  campaign_name: string | null;
  reference_code: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Broker {
  user_id: string;
  full_name: string | null;
}

const PROPERTY_TYPES = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "rural", label: "Rural" },
];

const TRANSACTION_TYPES = [
  { value: "venda", label: "Venda" },
  { value: "aluguel", label: "Aluguel" },
  { value: "venda_aluguel", label: "Venda e Aluguel" },
];

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "reservado", label: "Reservado", color: "bg-yellow-500" },
  { value: "vendido", label: "Vendido", color: "bg-blue-500" },
  { value: "alugado", label: "Alugado", color: "bg-purple-500" },
  { value: "inativo", label: "Inativo", color: "bg-gray-500" },
];

const PropertiesPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    title: "",
    type: "apartamento",
    transaction_type: "venda",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    area_m2: "",
    bedrooms: "",
    bathrooms: "",
    parking_spots: "",
    sale_price: "",
    rent_price: "",
    status: "disponivel",
    description: "",
    assigned_broker_id: "",
    reference_code: "",
  });

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBrokers();
    }
  }, [user]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Erro ao buscar imóveis:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os imóveis.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name");
      
      if (error) throw error;
      setBrokers(data || []);
    } catch (error) {
      console.error("Erro ao buscar corretores:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Título do imóvel é obrigatório.",
      });
      return;
    }

    try {
      const { data: accountData, error: accountError } = await supabase.rpc('get_user_account_id');
      if (accountError) throw accountError;

      const propertyData = {
        title: form.title,
        type: form.type,
        transaction_type: form.transaction_type,
        address: form.address || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        parking_spots: form.parking_spots ? parseInt(form.parking_spots) : null,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        rent_price: form.rent_price ? parseFloat(form.rent_price) : null,
        status: form.status,
        description: form.description || null,
        assigned_broker_id: form.assigned_broker_id || null,
        reference_code: form.reference_code || null,
        account_id: accountData,
      };

      if (editingProperty) {
        const { error } = await supabase
          .from("properties")
          .update(propertyData)
          .eq("id", editingProperty.id);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Imóvel atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("properties")
          .insert([propertyData]);
        
        if (error) throw error;
        toast({ title: "Sucesso", description: "Imóvel criado com sucesso!" });
      }

      setIsDialogOpen(false);
      setEditingProperty(null);
      resetForm();
      fetchProperties();
    } catch (error) {
      console.error("Erro ao salvar imóvel:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar o imóvel.",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Sucesso", description: "Imóvel removido com sucesso!" });
      fetchProperties();
    } catch (error) {
      console.error("Erro ao remover imóvel:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover o imóvel.",
      });
    }
  };

  const resetForm = () => {
    setForm({
      title: "",
      type: "apartamento",
      transaction_type: "venda",
      address: "",
      neighborhood: "",
      city: "",
      state: "",
      area_m2: "",
      bedrooms: "",
      bathrooms: "",
      parking_spots: "",
      sale_price: "",
      rent_price: "",
      status: "disponivel",
      description: "",
      assigned_broker_id: "",
    });
  };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property);
    setForm({
      title: property.title,
      type: property.type,
      transaction_type: property.transaction_type,
      address: property.address || "",
      neighborhood: property.neighborhood || "",
      city: property.city || "",
      state: property.state || "",
      area_m2: property.area_m2?.toString() || "",
      bedrooms: property.bedrooms?.toString() || "",
      bathrooms: property.bathrooms?.toString() || "",
      parking_spots: property.parking_spots?.toString() || "",
      sale_price: property.sale_price?.toString() || "",
      rent_price: property.rent_price?.toString() || "",
      status: property.status,
      description: property.description || "",
      assigned_broker_id: property.assigned_broker_id || "",
      reference_code: property.reference_code || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProperty(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const formatPrice = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUS_OPTIONS.find(s => s.value === status);
    return statusInfo || { label: status, color: "bg-gray-500" };
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.neighborhood?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || property.status === filterStatus;
    const matchesType = filterType === "all" || property.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de imóveis</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Imóvel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProperty ? "Editar Imóvel" : "Novo Imóvel"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex: Apartamento 3 quartos no Centro"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Transação</Label>
                  <Select value={form.transaction_type} onValueChange={v => setForm({ ...form, transaction_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua, número"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={e => setForm({ ...form, neighborhood: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-4 gap-2 col-span-2">
                  <div className="space-y-2">
                    <Label htmlFor="area_m2">Área (m²)</Label>
                    <Input
                      id="area_m2"
                      type="number"
                      value={form.area_m2}
                      onChange={e => setForm({ ...form, area_m2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Quartos</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      value={form.bedrooms}
                      onChange={e => setForm({ ...form, bedrooms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Banheiros</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      value={form.bathrooms}
                      onChange={e => setForm({ ...form, bathrooms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parking_spots">Vagas</Label>
                    <Input
                      id="parking_spots"
                      type="number"
                      value={form.parking_spots}
                      onChange={e => setForm({ ...form, parking_spots: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Preço de Venda</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    value={form.sale_price}
                    onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    placeholder="R$"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rent_price">Preço de Aluguel</Label>
                  <Input
                    id="rent_price"
                    type="number"
                    value={form.rent_price}
                    onChange={e => setForm({ ...form, rent_price: e.target.value })}
                    placeholder="R$"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Corretor Responsável</Label>
                  <Select 
                    value={form.assigned_broker_id || "none"} 
                    onValueChange={v => setForm({ ...form, assigned_broker_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {brokers.map(b => (
                        <SelectItem key={b.user_id} value={b.user_id}>
                          {b.full_name || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Detalhes do imóvel..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingProperty ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar imóveis..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {PROPERTY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Property Grid */}
      {filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum imóvel encontrado</h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm || filterStatus !== "all" || filterType !== "all"
                ? "Tente ajustar os filtros"
                : "Comece adicionando seu primeiro imóvel"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map(property => {
            const statusInfo = getStatusBadge(property.status);
            const typeInfo = PROPERTY_TYPES.find(t => t.value === property.type);
            const broker = brokers.find(b => b.user_id === property.assigned_broker_id);
            
            return (
              <Card 
                key={property.id} 
                className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                onClick={() => {
                  setSelectedProperty(property);
                  setIsDetailModalOpen(true);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{property.title}</CardTitle>
                      {property.neighborhood && property.city && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {property.neighborhood}, {property.city}
                        </CardDescription>
                      )}
                    </div>
                    <Badge className={`${statusInfo.color} text-white shrink-0`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Badge variant="outline">{typeInfo?.label || property.type}</Badge>
                    {property.area_m2 && <span>{property.area_m2}m²</span>}
                    {property.bedrooms && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-3 w-3" /> {property.bedrooms}
                      </span>
                    )}
                    {property.bathrooms && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-3 w-3" /> {property.bathrooms}
                      </span>
                    )}
                    {property.parking_spots && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> {property.parking_spots}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {property.sale_price && (
                      <p className="text-lg font-bold text-primary">
                        Venda: {formatPrice(property.sale_price)}
                      </p>
                    )}
                    {property.rent_price && (
                      <p className="text-sm text-muted-foreground">
                        Aluguel: {formatPrice(property.rent_price)}/mês
                      </p>
                    )}
                  </div>
                  
                  {broker && (
                    <p className="text-xs text-muted-foreground">
                      Corretor: {broker.full_name}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProperty(property);
                        setIsDetailModalOpen(true);
                      }}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(property);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover imóvel?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(property.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Property Detail Modal */}
      <PropertyDetailModal
        property={selectedProperty}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedProperty(null);
        }}
        onEdit={(property) => {
          setIsDetailModalOpen(false);
          openEditDialog(property);
        }}
        onDelete={async (propertyId) => {
          await handleDelete(propertyId);
        }}
        onStatusChange={() => {
          fetchProperties();
        }}
      />
    </div>
  );
};

export default PropertiesPage;
