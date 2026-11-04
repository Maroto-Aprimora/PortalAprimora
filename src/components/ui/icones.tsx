/**
 * Ponto único dos ícones do portal (biblioteca Tabler Icons).
 *
 * As telas importam daqui, nunca direto de "@tabler/icons-react": trocar de biblioteca,
 * de espessura de traço ou de ícone vira uma mudança só neste arquivo.
 * Os nomes exportados descrevem o uso (Plus, Trash2…) e foram mantidos da biblioteca anterior.
 * Tamanho: pela classe (h-4 w-4 é o padrão em texto; h-5 w-5 em botões só de ícone).
 */
import { forwardRef } from "react";
import type { IconProps, TablerIcon } from "@tabler/icons-react";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowLeft,
  IconArrowsLeftRight,
  IconBell,
  IconBellOff,
  IconBellRinging,
  IconBuilding,
  IconCalendar,
  IconCalendarOff,
  IconCalendarPlus,
  IconCalendarTime,
  IconChartBar,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClipboardCheck,
  IconClock,
  IconCoin,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFileOff,
  IconFileText,
  IconFilter,
  IconFlag,
  IconFolderOpen,
  IconGauge,
  IconHeartHandshake,
  IconHistory,
  IconInbox,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconList,
  IconListCheck,
  IconLoader2,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMenu2,
  IconMessage,
  IconMessageCircle,
  IconMoon,
  IconPackage,
  IconPaperclip,
  IconPencil,
  IconPhone,
  IconPhoneCall,
  IconPhoneOff,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRobot,
  IconRosetteDiscountCheck,
  IconRotate,
  IconSearch,
  IconSearchOff,
  IconSelector,
  IconSend,
  IconSettings,
  IconShieldExclamation,
  IconSignature,
  IconSparkles,
  IconStar,
  IconSun,
  IconTag,
  IconTarget,
  IconTool,
  IconTrash,
  IconTrendingUp,
  IconTrophy,
  IconUser,
  IconUserOff,
  IconUserPlus,
  IconUsers,
  IconWallet,
  IconWorld,
  IconX,
} from "@tabler/icons-react";

/** Traço padrão: mais fino que o 2 da biblioteca, para um desenho mais leve. */
export const TRACO_ICONE = 1.75;

export type Icone = React.ComponentType<{ className?: string }>;

function comTraco(Base: TablerIcon, nome: string) {
  const C = forwardRef<SVGSVGElement, IconProps>(function IconePadrao(props, ref) {
    return <Base ref={ref} stroke={TRACO_ICONE} aria-hidden {...props} />;
  });
  C.displayName = nome;
  return C;
}

export const AlertTriangle = comTraco(IconAlertTriangle, "AlertTriangle");
export const ArrowLeft = comTraco(IconArrowLeft, "ArrowLeft");
export const ArrowRightLeft = comTraco(IconArrowsLeftRight, "ArrowRightLeft");
export const BadgeCheck = comTraco(IconRosetteDiscountCheck, "BadgeCheck");
export const BadgeDollarSign = comTraco(IconCoin, "BadgeDollarSign");
export const BarChart3 = comTraco(IconChartBar, "BarChart3");
export const Bell = comTraco(IconBell, "Bell");
export const BellRing = comTraco(IconBellRinging, "BellRing");
export const Bot = comTraco(IconRobot, "Bot");
export const Building2 = comTraco(IconBuilding, "Building2");
export const CalendarClock = comTraco(IconCalendarTime, "CalendarClock");
export const CalendarDays = comTraco(IconCalendar, "CalendarDays");
export const CalendarPlus = comTraco(IconCalendarPlus, "CalendarPlus");
export const Check = comTraco(IconCheck, "Check");
export const CheckCheck = comTraco(IconChecks, "CheckCheck");
export const ChevronDown = comTraco(IconChevronDown, "ChevronDown");
export const ChevronLeft = comTraco(IconChevronLeft, "ChevronLeft");
export const ChevronRight = comTraco(IconChevronRight, "ChevronRight");
export const ChevronsLeftRight = comTraco(IconSelector, "ChevronsLeftRight");
export const ClipboardCheck = comTraco(IconClipboardCheck, "ClipboardCheck");
export const Clock = comTraco(IconClock, "Clock");
export const Copy = comTraco(IconCopy, "Copy");
export const Download = comTraco(IconDownload, "Download");
export const ExternalLink = comTraco(IconExternalLink, "ExternalLink");
export const FileSignature = comTraco(IconSignature, "FileSignature");
export const FileText = comTraco(IconFileText, "FileText");
export const Filter = comTraco(IconFilter, "Filter");
export const Flag = comTraco(IconFlag, "Flag");
export const Gauge = comTraco(IconGauge, "Gauge");
export const Globe = comTraco(IconWorld, "Globe");
export const Handshake = comTraco(IconHeartHandshake, "Handshake");
export const History = comTraco(IconHistory, "History");
export const Inbox = comTraco(IconInbox, "Inbox");
export const KanbanSquare = comTraco(IconLayoutKanban, "KanbanSquare");
export const LayoutDashboard = comTraco(IconLayoutDashboard, "LayoutDashboard");
export const List = comTraco(IconList, "List");
export const ListChecks = comTraco(IconListCheck, "ListChecks");
export const Loader2 = comTraco(IconLoader2, "Loader2");
export const LogOut = comTraco(IconLogout, "LogOut");
export const Mail = comTraco(IconMail, "Mail");
export const MapPin = comTraco(IconMapPin, "MapPin");
export const Menu = comTraco(IconMenu2, "Menu");
export const MessageCircle = comTraco(IconMessageCircle, "MessageCircle");
export const MessageSquare = comTraco(IconMessage, "MessageSquare");
export const Moon = comTraco(IconMoon, "Moon");
export const PackageSearch = comTraco(IconPackage, "PackageSearch");
export const PanelLeftClose = comTraco(IconLayoutSidebarLeftCollapse, "PanelLeftClose");
export const PanelLeftOpen = comTraco(IconLayoutSidebarLeftExpand, "PanelLeftOpen");
export const Paperclip = comTraco(IconPaperclip, "Paperclip");
export const Pencil = comTraco(IconPencil, "Pencil");
export const Phone = comTraco(IconPhone, "Phone");
export const PhoneCall = comTraco(IconPhoneCall, "PhoneCall");
export const Plus = comTraco(IconPlus, "Plus");
export const Printer = comTraco(IconPrinter, "Printer");
export const RefreshCw = comTraco(IconRefresh, "RefreshCw");
export const RotateCcw = comTraco(IconRotate, "RotateCcw");
export const Search = comTraco(IconSearch, "Search");
export const Send = comTraco(IconSend, "Send");
export const Settings = comTraco(IconSettings, "Settings");
export const ShieldAlert = comTraco(IconShieldExclamation, "ShieldAlert");
export const Sparkles = comTraco(IconSparkles, "Sparkles");
export const Star = comTraco(IconStar, "Star");
export const Sun = comTraco(IconSun, "Sun");
export const Tag = comTraco(IconTag, "Tag");
export const Target = comTraco(IconTarget, "Target");
export const Trash2 = comTraco(IconTrash, "Trash2");
export const TrendingUp = comTraco(IconTrendingUp, "TrendingUp");
export const Trophy = comTraco(IconTrophy, "Trophy");
export const Undo2 = comTraco(IconArrowBackUp, "Undo2");
export const User = comTraco(IconUser, "User");
export const UserPlus = comTraco(IconUserPlus, "UserPlus");
export const Users = comTraco(IconUsers, "Users");
export const Wallet = comTraco(IconWallet, "Wallet");
export const Wrench = comTraco(IconTool, "Wrench");
export const X = comTraco(IconX, "X");
export const SearchOff = comTraco(IconSearchOff, "SearchOff");
export const CircleCheck = comTraco(IconCircleCheck, "CircleCheck");
export const CalendarOff = comTraco(IconCalendarOff, "CalendarOff");
export const BellOff = comTraco(IconBellOff, "BellOff");
export const FileOff = comTraco(IconFileOff, "FileOff");
export const PhoneOff = comTraco(IconPhoneOff, "PhoneOff");
export const UserOff = comTraco(IconUserOff, "UserOff");
export const FolderOpen = comTraco(IconFolderOpen, "FolderOpen");
