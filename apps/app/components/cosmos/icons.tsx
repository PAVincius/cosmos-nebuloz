// icons.tsx — cosmos icon set. The handoff shipped custom lucide-style SVG paths;
// we back them with lucide-react (installed) keyed by the same string names the
// kit/shell reference. ponytail: reuse lucide instead of hand-porting ~60 paths.
import {
  Activity,
  AlertTriangle,
  Anchor,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Code,
  Columns3,
  Compass,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flag,
  FlaskConical,
  Gauge,
  GitBranch,
  GripVertical,
  Key,
  Layers,
  LayoutGrid,
  Lock,
  type LucideIcon,
  Mail,
  Maximize2,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Pause,
  Play,
  Plug,
  Plus,
  Puzzle,
  RefreshCw,
  Route,
  Scale,
  Search,
  Send,
  Settings,
  Shield,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wand2,
  Webhook,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";

const ICONS = {
  search: Search,
  plus: Plus,
  arrowRight: ArrowRight,
  grid: LayoutGrid,
  target: Target,
  users: Users,
  barChart: BarChart3,
  flow: Workflow,
  anchor: Anchor,
  plug: Plug,
  settings: Settings,
  webhook: Webhook,
  bot: Bot,
  bell: Bell,
  sun: Sun,
  moon: Moon,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronsUpDown: ChevronsUpDown,
  trend: TrendingUp,
  trending: TrendingUp,
  kanban: Columns3,
  x: X,
  shuffle: Shuffle,
  flask: FlaskConical,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  activity: Activity,
  check: Check,
  clock: Clock,
  dollar: DollarSign,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  gauge: Gauge,
  layers: Layers,
  zap: Zap,
  alert: AlertTriangle,
  calendar: Calendar,
  tag: Tag,
  filter: Filter,
  wand: Wand2,
  panelLeft: PanelLeft,
  more: MoreHorizontal,
  gripVertical: GripVertical,
  externalLink: ExternalLink,
  arrowUpRight: ArrowUpRight,
  paperclip: Paperclip,
  send: Send,
  flag: Flag,
  building: Building2,
  shield: Shield,
  gitBranch: GitBranch,
  star: Star,
  route: Route,
  wallet: Wallet,
  compass: Compass,
  pulse: Activity,
  scale: Scale,
  refresh: RefreshCw,
  award: Award,
  book: BookOpen,
  play: Play,
  pause: Pause,
  puzzle: Puzzle,
  lock: Lock,
  key: Key,
  code: Code,
  message: MessageSquare,
  mail: Mail,
  copy: Copy,
  eye: Eye,
  download: Download,
  maximize: Maximize2,
  fileText: FileText,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName | (string & {});
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.9,
  style,
  className,
}: IconProps) {
  const Cmp = ICONS[name as IconName];
  if (!Cmp) {
    return null;
  }
  return (
    <Cmp
      aria-hidden="true"
      className={className}
      height={size}
      strokeWidth={strokeWidth}
      style={{ display: "block", flexShrink: 0, ...style }}
      width={size}
    />
  );
}
