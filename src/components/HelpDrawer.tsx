import { X, HelpCircle, BarChart2, AlertCircle, FileText, Bell, MapPin, Clock, Check, BookOpen, Video, Download, MessageSquare, Calendar, BookMarked, Folder, Heart, Star, Upload, User, Lock, Layout, Users, UserCheck, Award, GraduationCap, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HelpContent } from "@/lib/helpContent";

const iconMap: Record<string, React.ElementType> = {
  "ti-chart-bar": BarChart2,
  "ti-alert-circle": AlertCircle,
  "ti-file-text": FileText,
  "ti-bell": Bell,
  "ti-map-pin": MapPin,
  "ti-clock": Clock,
  "ti-check": Check,
  "ti-book": BookOpen,
  "ti-video": Video,
  "ti-download": Download,
  "ti-message": MessageSquare,
  "ti-calendar": Calendar,
  "ti-books": BookMarked,
  "ti-folder": Folder,
  "ti-heart": Heart,
  "ti-star": Star,
  "ti-upload": Upload,
  "ti-user": User,
  "ti-lock": Lock,
  "ti-layout": Layout,
  "ti-users": Users,
  "ti-user-check": UserCheck,
  "ti-award": Award,
  "ti-school": GraduationCap,
  "ti-clipboard-list": ClipboardList,
  "ti-eye": HelpCircle,
  "ti-circle-check": Check,
  "ti-external-link": Download,
};

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  content: HelpContent | null;
}

export default function HelpDrawer({ open, onClose, content }: HelpDrawerProps) {
  if (!content) return null;

  const body = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{content.title}</span>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {content.items.map((item, i) => {
          const Icon = iconMap[item.icon] ?? HelpCircle;
          return (
            <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop — drawer lateral */}
      <div className={cn(
        "hidden lg:flex flex-col border-l border-border bg-card flex-shrink-0 transition-all duration-200 overflow-hidden",
        open ? "w-72" : "w-0 border-0"
      )}>
        {open && body}
      </div>

      {/* Mobile — sheet de baixo */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="relative bg-card rounded-t-2xl flex flex-col max-h-[70vh] shadow-lg">
            <div className="w-9 h-1 bg-border rounded-full mx-auto mt-3 mb-1" />
            {body}
          </div>
        </div>
      )}
    </>
  );
}
