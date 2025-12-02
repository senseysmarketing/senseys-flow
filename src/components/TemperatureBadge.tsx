import { Badge } from "@/components/ui/badge";
import { Flame, Thermometer, Snowflake } from "lucide-react";

interface TemperatureBadgeProps {
  temperature: 'hot' | 'warm' | 'cold' | string | null | undefined;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const temperatureConfig = {
  hot: {
    label: 'Quente',
    icon: Flame,
    className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
  },
  warm: {
    label: 'Morno',
    icon: Thermometer,
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30',
  },
  cold: {
    label: 'Frio',
    icon: Snowflake,
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  },
};

const TemperatureBadge = ({ temperature, showLabel = true, size = 'sm' }: TemperatureBadgeProps) => {
  const temp = temperature || 'warm';
  const config = temperatureConfig[temp as keyof typeof temperatureConfig] || temperatureConfig.warm;
  const Icon = config.icon;
  
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'} gap-1`}
    >
      <Icon className={iconSize} />
      {showLabel && config.label}
    </Badge>
  );
};

export default TemperatureBadge;
