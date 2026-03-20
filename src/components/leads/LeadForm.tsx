import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import BrokerSelect from "@/components/BrokerSelect";
import PropertySelect from "@/components/PropertySelect";
import { leadFormSchema, type LeadFormValues, type LeadStatus } from "@/types/leads";

interface LeadFormProps {
  defaultValues?: Partial<LeadFormValues>;
  statuses: LeadStatus[];
  canAssignLeads: boolean;
  loading: boolean;
  onSubmit: (data: LeadFormValues) => void;
  onCancel: () => void;
  submitLabel?: string;
  loadingLabel?: string;
}

const LeadForm = ({
  defaultValues,
  statuses,
  canAssignLeads,
  loading,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  loadingLabel = "Salvando...",
}: LeadFormProps) => {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      interesse: "",
      observacoes: "",
      origem: "",
      campanha: "",
      conjunto: "",
      anuncio: "",
      status_id: "",
      temperature: "warm",
      assigned_broker_id: null,
      property_id: null,
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone *</FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="interesse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interesse</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Apartamento 2 quartos..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperatura</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a temperatura" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hot">
                      <span className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-red-500" />
                        Quente
                      </span>
                    </SelectItem>
                    <SelectItem value="warm">
                      <span className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-yellow-500" />
                        Morno
                      </span>
                    </SelectItem>
                    <SelectItem value="cold">
                      <span className="flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                        Frio
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Facebook, Google, Indicação..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="campanha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campanha</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {canAssignLeads && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="assigned_broker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corretor Responsável</FormLabel>
                  <FormControl>
                    <BrokerSelect
                      value={field.value || null}
                      onValueChange={field.onChange}
                      placeholder="Selecionar corretor"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imóvel de Interesse</FormLabel>
                  <FormControl>
                    <PropertySelect
                      value={field.value || null}
                      onValueChange={field.onChange}
                      placeholder="Selecionar imóvel"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Informações adicionais sobre o lead..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? loadingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default LeadForm;
