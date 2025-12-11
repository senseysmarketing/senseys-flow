import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings2 } from "lucide-react";

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface LeadsColumnSelectorProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

const LeadsColumnSelector = ({ columns, onColumnsChange }: LeadsColumnSelectorProps) => {
  const handleToggle = (key: string) => {
    const updated = columns.map((col) =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updated);
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Colunas
          <span className="text-xs text-muted-foreground">({visibleCount})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-1">
          <h4 className="font-medium text-sm mb-3">Colunas Visíveis</h4>
          {columns.map((column) => (
            <div
              key={column.key}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
              onClick={() => handleToggle(column.key)}
            >
              <Checkbox checked={column.visible} />
              <span className="text-sm">{column.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LeadsColumnSelector;
