import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Filter, X, Flame, Thermometer, Snowflake, Users, Building2, Calendar, Megaphone, Target, Heart } from "lucide-react";
import BrokerSelect from "@/components/BrokerSelect";
import PropertySelect from "@/components/PropertySelect";

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

interface LeadsFiltersProps {
  statuses: LeadStatus[];
  filters: {
    statuses: string[];
    temperatures: string[];
    origins: string[];
    campaigns: string[];
    ads: string[];
    interests: string[];
    brokerId: string | null;
    propertyId: string | null;
    startDate: string;
    endDate: string;
    noBroker: boolean;
    noProperty: boolean;
    noActivity: number | null;
  };
  onFiltersChange: (filters: LeadsFiltersProps["filters"]) => void;
  uniqueOrigins: string[];
  uniqueCampaigns: string[];
  uniqueAds: string[];
  uniqueInterests: string[];
}

const LeadsFilters = ({ 
  statuses, 
  filters, 
  onFiltersChange, 
  uniqueOrigins,
  uniqueCampaigns,
  uniqueAds,
  uniqueInterests,
}: LeadsFiltersProps) => {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const activeFiltersCount =
    filters.statuses.length +
    filters.temperatures.length +
    filters.origins.length +
    filters.campaigns.length +
    filters.ads.length +
    filters.interests.length +
    (filters.brokerId ? 1 : 0) +
    (filters.propertyId ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0) +
    (filters.noBroker ? 1 : 0) +
    (filters.noProperty ? 1 : 0) +
    (filters.noActivity ? 1 : 0);

  const handleStatusToggle = (statusId: string) => {
    const updated = localFilters.statuses.includes(statusId)
      ? localFilters.statuses.filter((s) => s !== statusId)
      : [...localFilters.statuses, statusId];
    setLocalFilters({ ...localFilters, statuses: updated });
  };

  const handleTemperatureToggle = (temp: string) => {
    const updated = localFilters.temperatures.includes(temp)
      ? localFilters.temperatures.filter((t) => t !== temp)
      : [...localFilters.temperatures, temp];
    setLocalFilters({ ...localFilters, temperatures: updated });
  };

  const handleOriginToggle = (origin: string) => {
    const updated = localFilters.origins.includes(origin)
      ? localFilters.origins.filter((o) => o !== origin)
      : [...localFilters.origins, origin];
    setLocalFilters({ ...localFilters, origins: updated });
  };

  const handleCampaignToggle = (campaign: string) => {
    const updated = localFilters.campaigns.includes(campaign)
      ? localFilters.campaigns.filter((c) => c !== campaign)
      : [...localFilters.campaigns, campaign];
    setLocalFilters({ ...localFilters, campaigns: updated });
  };

  const handleAdToggle = (ad: string) => {
    const updated = localFilters.ads.includes(ad)
      ? localFilters.ads.filter((a) => a !== ad)
      : [...localFilters.ads, ad];
    setLocalFilters({ ...localFilters, ads: updated });
  };

  const handleInterestToggle = (interest: string) => {
    const updated = localFilters.interests.includes(interest)
      ? localFilters.interests.filter((i) => i !== interest)
      : [...localFilters.interests, interest];
    setLocalFilters({ ...localFilters, interests: updated });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const cleared = {
      statuses: [],
      temperatures: [],
      origins: [],
      campaigns: [],
      ads: [],
      interests: [],
      brokerId: null,
      propertyId: null,
      startDate: "",
      endDate: "",
      noBroker: false,
      noProperty: false,
      noActivity: null,
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Filtros Avançados
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar tudo
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Status */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                Status
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {statuses.map((status) => (
                  <div
                    key={status.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      localFilters.statuses.includes(status.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleStatusToggle(status.id)}
                  >
                    <Checkbox checked={localFilters.statuses.includes(status.id)} />
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-sm">{status.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Temperatura */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Temperatura
              </Label>
              <div className="flex gap-2">
                {[
                  { value: "hot", label: "Quente", icon: Flame, color: "text-red-500" },
                  { value: "warm", label: "Morno", icon: Thermometer, color: "text-yellow-500" },
                  { value: "cold", label: "Frio", icon: Snowflake, color: "text-blue-500" },
                ].map((temp) => (
                  <div
                    key={temp.value}
                    className={`flex items-center gap-2 p-2 px-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                      localFilters.temperatures.includes(temp.value)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => handleTemperatureToggle(temp.value)}
                  >
                    <Checkbox checked={localFilters.temperatures.includes(temp.value)} />
                    <temp.icon className={`h-4 w-4 ${temp.color}`} />
                    <span className="text-sm">{temp.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Origem */}
            {uniqueOrigins.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Origem</Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueOrigins.map((origin) => (
                      <Badge
                        key={origin}
                        variant={localFilters.origins.includes(origin) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleOriginToggle(origin)}
                      >
                        {origin}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Campanha */}
            {uniqueCampaigns.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Campanha
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueCampaigns.map((campaign) => (
                      <Badge
                        key={campaign}
                        variant={localFilters.campaigns.includes(campaign) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleCampaignToggle(campaign)}
                      >
                        {campaign}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Anúncio */}
            {uniqueAds.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Anúncio
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueAds.map((ad) => (
                      <Badge
                        key={ad}
                        variant={localFilters.ads.includes(ad) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleAdToggle(ad)}
                      >
                        {ad}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Interesse */}
            {uniqueInterests.length > 0 && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Interesse
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueInterests.map((interest) => (
                      <Badge
                        key={interest}
                        variant={localFilters.interests.includes(interest) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleInterestToggle(interest)}
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Corretor */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Corretor
              </Label>
              <BrokerSelect
                value={localFilters.brokerId}
                onValueChange={(value) => setLocalFilters({ ...localFilters, brokerId: value })}
                placeholder="Todos os corretores"
              />
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  localFilters.noBroker ? "bg-primary/10 border-primary" : "hover:bg-muted"
                }`}
                onClick={() => setLocalFilters({ ...localFilters, noBroker: !localFilters.noBroker })}
              >
                <Checkbox checked={localFilters.noBroker} />
                <span className="text-sm">Apenas leads sem corretor atribuído</span>
              </div>
            </div>

            <Separator />

            {/* Imóvel */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Imóvel
              </Label>
              <PropertySelect
                value={localFilters.propertyId}
                onValueChange={(value) => setLocalFilters({ ...localFilters, propertyId: value })}
                placeholder="Todos os imóveis"
              />
              <div
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  localFilters.noProperty ? "bg-primary/10 border-primary" : "hover:bg-muted"
                }`}
                onClick={() => setLocalFilters({ ...localFilters, noProperty: !localFilters.noProperty })}
              >
                <Checkbox checked={localFilters.noProperty} />
                <span className="text-sm">Apenas leads sem imóvel associado</span>
              </div>
            </div>

            <Separator />

            {/* Período */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período de Criação
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data inicial</Label>
                  <Input
                    type="date"
                    value={localFilters.startDate}
                    onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data final</Label>
                  <Input
                    type="date"
                    value={localFilters.endDate}
                    onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Filtros Especiais */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Filtros Especiais</Label>
              <div className="space-y-2">
                {[3, 7, 14, 30].map((days) => (
                  <div
                    key={days}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      localFilters.noActivity === days
                        ? "bg-warning/10 border-warning"
                        : "hover:bg-muted"
                    }`}
                    onClick={() =>
                      setLocalFilters({
                        ...localFilters,
                        noActivity: localFilters.noActivity === days ? null : days,
                      })
                    }
                  >
                    <Checkbox checked={localFilters.noActivity === days} />
                    <span className="text-sm">Sem atividade há {days} dias</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t mt-4">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LeadsFilters;
