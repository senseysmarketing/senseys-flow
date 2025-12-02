import { Badge } from "@/components/ui/badge";
import { Camera, Facebook, Search, Globe, MessageCircle, User, Megaphone } from "lucide-react";

interface OriginBadgeProps {
  origem: string | null | undefined;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const originConfig = {
  instagram: {
    aliases: ['ig', 'instagram', 'insta'],
    label: 'Instagram',
    icon: Camera,
    className: 'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
  },
  facebook: {
    aliases: ['fb', 'facebook', 'face', 'facebook ads', 'meta'],
    label: 'Facebook',
    icon: Facebook,
    className: 'bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30',
  },
  google: {
    aliases: ['google', 'gads', 'google ads', 'adwords', 'googleads'],
    label: 'Google Ads',
    icon: Search,
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30',
  },
  site: {
    aliases: ['site', 'website', 'web', 'landing', 'lp', 'landingpage'],
    label: 'Site',
    icon: Globe,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
  },
  whatsapp: {
    aliases: ['whatsapp', 'wpp', 'zap', 'wa', 'whats'],
    label: 'WhatsApp',
    icon: MessageCircle,
    className: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
  },
  manual: {
    aliases: ['manual', 'telefone', 'indicacao', 'indicação', 'phone', 'ligacao', 'ligação'],
    label: 'Manual',
    icon: User,
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30',
  },
};

const defaultConfig = {
  label: 'Outros',
  icon: Megaphone,
  className: 'bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30',
};

const getOriginConfig = (origem: string | null | undefined) => {
  if (!origem) return { ...defaultConfig, label: 'Outros' };
  
  const normalizedOrigem = origem.toLowerCase().trim();
  
  for (const [, config] of Object.entries(originConfig)) {
    if (config.aliases.some(alias => normalizedOrigem.includes(alias))) {
      return config;
    }
  }
  
  return { ...defaultConfig, label: origem.length > 10 ? origem.slice(0, 10) + '...' : origem };
};

const OriginBadge = ({ origem, showLabel = true, size = 'sm' }: OriginBadgeProps) => {
  const config = getOriginConfig(origem);
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

export default OriginBadge;
