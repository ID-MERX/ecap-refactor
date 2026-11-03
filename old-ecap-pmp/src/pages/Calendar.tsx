import { useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Tag,
  MoreHorizontal,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  CalendarEvent,
} from "@/lib/directus";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORIES = [
  {
    name: "Meeting",
    color: "bg-emerald-500",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  {
    name: "Field Visit",
    color: "bg-emerald-500",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  {
    name: "Deadline",
    color: "bg-rose-500",
    border: "border-rose-200",
    text: "text-rose-700",
  },
  {
    name: "Personal",
    color: "bg-amber-500",
    border: "border-amber-200",
    text: "text-amber-700",
  },
];

const CalendarPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: "",
    description: "",
    category: "Meeting",
    status: "scheduled",
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", user?.id],
    queryFn: () => getCalendarEvents(user?.id || ""),
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsAddModalOpen(false);
      toast.success("Event scheduled successfully!");
    },
    onError: () => toast.error("Failed to schedule event"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsDetailModalOpen(false);
      toast.success("Event deleted successfully");
    },
    onError: () => toast.error("Failed to delete event"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<CalendarEvent>;
    }) => updateCalendarEvent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setIsAddModalOpen(false);
      toast.success("Event updated successfully!");
    },
    onError: () => toast.error("Failed to update event"),
  });

  const handlePrev = () => {
    if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const days = [];
    let day = startDate;

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="bg-slate-50 py-3 text-center text-[10px] font-bold tracking-widest text-slate-500"
          >
            {d}
          </div>
        ))}
        {allDays.map((d, i) => {
          const dayEvents = events.filter((e) =>
            isSameDay(new Date(e.start_time), d),
          );
          return (
            <div
              key={i}
              className={cn(
                "min-h-[120px] bg-white p-2 transition-colors hover:bg-slate-50/50 group relative",
                !isSameMonth(d, monthStart) && "bg-slate-50/30 text-slate-400",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "text-sm font-semibold h-7 w-7 flex items-center justify-center rounded-full transition-all",
                    isToday(d)
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "text-slate-600 group-hover:bg-slate-200/50",
                  )}
                >
                  {format(d, dateFormat)}
                </span>
                {dayEvents.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-slate-100 text-[10px] h-5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {dayEvents.length} Events
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "text-[10px] p-1.5 rounded-md border shadow-sm truncate font-medium cursor-pointer transition-transform hover:scale-[1.02]",
                      CATEGORIES.find((c) => c.name === event.category)
                        ?.color.replace("bg-", "bg-")
                        .concat("/10"),
                      CATEGORIES.find((c) => c.name === event.category)?.border,
                      CATEGORIES.find((c) => c.name === event.category)?.text,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {event.title}
                  </div>
                ))}

                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-slate-400 font-bold px-1.5 truncate">
                    + {dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(currentDate);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-4 h-full">
        {allDays.map((d, i) => {
          const dayEvents = events.filter((e) =>
            isSameDay(new Date(e.start_time), d),
          );
          return (
            <div key={i} className="flex flex-col gap-3 group">
              <div
                className={cn(
                  "p-3 rounded-2xl flex flex-col items-center gap-1 transition-all border",
                  isToday(d)
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20"
                    : "bg-white border-slate-100 group-hover:border-slate-300",
                )}
              >
                <span className="text-[10px] font-black tracking-widest opacity-60">
                  {format(d, "EEE")}
                </span>
                <span className="text-xl font-black">{format(d, "d")}</span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-1 custom-scrollbar min-h-[300px]">
                {dayEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-2xl border shadow-sm cursor-pointer transition-all hover:scale-[1.02] flex flex-col gap-1",
                      CATEGORIES.find((c) => c.name === event.category)
                        ?.color.replace("bg-", "bg-")
                        .concat("/10"),
                      CATEGORIES.find((c) => c.name === event.category)?.border,
                      CATEGORIES.find((c) => c.name === event.category)?.text,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <p className="font-black text-[11px] leading-tight">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-1 opacity-70 text-[9px] font-bold">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.start_time), "HH:mm")}
                    </div>
                  </div>
                ))}
                {dayEvents.length === 0 && (
                  <div className="h-20 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center opacity-40">
                    <span className="text-[10px] font-bold tracking-widest">
                      Free
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = events.filter((e) =>
      isSameDay(new Date(e.start_time), currentDate),
    );

    return (
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-6 bg-white p-6 rounded-3xl border shadow-sm">
          <div className="h-20 w-20 rounded-2xl bg-emerald-600 flex flex-col items-center justify-center text-white shadow-xl shadow-emerald-600/20">
            <span className="text-[10px] font-black tracking-widest opacity-70">
              {format(currentDate, "EEE")}
            </span>
            <span className="text-3xl font-black">
              {format(currentDate, "d")}
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <p className="text-slate-500 font-medium">
              You have {dayEvents.length} events scheduled for today.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {dayEvents.map((event, idx) => (
            <div
              key={idx}
              className={cn(
                "p-6 rounded-3xl border shadow-sm cursor-pointer transition-all hover:scale-[1.01] flex items-center gap-6",
                CATEGORIES.find((c) => c.name === event.category)
                  ?.color.replace("bg-", "bg-")
                  .concat("/10"),
                CATEGORIES.find((c) => c.name === event.category)?.border,
                CATEGORIES.find((c) => c.name === event.category)?.text,
              )}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEvent(event);
                setIsDetailModalOpen(true);
              }}
            >
              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <span className="text-lg font-black">
                  {format(new Date(event.start_time), "HH:mm")}
                </span>
                <span className="text-[10px] font-black tracking-widest opacity-60">
                  Start
                </span>
              </div>

              <div className="w-px h-12 bg-current opacity-20" />

              <div className="flex-1">
                <Badge
                  variant="outline"
                  className="mb-2 bg-white/50 border-current/20 text-current font-black text-[9px] tracking-widest"
                >
                  {event.category}
                </Badge>
                <h4 className="text-xl font-black leading-tight mb-1">
                  {event.title}
                </h4>
                {event.description && (
                  <p className="text-sm opacity-80 line-clamp-1">
                    {event.description}
                  </p>
                )}
              </div>

              <ChevronRight className="h-6 w-6 opacity-30" />
            </div>
          ))}

          {dayEvents.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <CalendarIcon className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-400 font-bold tracking-widest text-sm">
                No events scheduled
              </p>
              <Button
                variant="link"
                className="text-emerald-600 font-black tracking-widest text-xs mt-2"
                onClick={openAddModal}
              >
                Schedule Something
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSaveEvent = () => {
    if (
      !newEvent.title ||
      !user?.id ||
      !newEvent.start_time ||
      !newEvent.end_time
    )
      return;

    // Explicitly convert local time string to UTC ISO string
    const preparedEvent = {
      ...newEvent,
      user_id: user.id,
      start_time: new Date(newEvent.start_time).toISOString(),
      end_time: new Date(newEvent.end_time).toISOString(),
    };

    if (isEditing && selectedEvent) {
      updateMutation.mutate({ id: selectedEvent.id, payload: preparedEvent });
    } else {
      createMutation.mutate(preparedEvent);
    }
  };

  const handleEditClick = () => {
    if (!selectedEvent) return;
    setNewEvent({
      title: selectedEvent.title,
      description: selectedEvent.description || "",
      category: selectedEvent.category,
      start_time: format(
        new Date(selectedEvent.start_time),
        "yyyy-MM-dd'T'HH:mm",
      ),
      end_time: format(new Date(selectedEvent.end_time), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsEditing(true);
    setIsDetailModalOpen(false);
    setIsAddModalOpen(true);
  };

  const openAddModal = () => {
    setNewEvent({
      title: "",
      description: "",
      category: "Meeting",
      status: "scheduled",
      start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsEditing(false);
    setIsAddModalOpen(true);
  };

  return (
    <DashboardLayout title="Event Calendar">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Controls (sticky on lg+) */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
            <button onClick={openAddModal} className="group relative w-full">
              <div
                aria-hidden
                className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 blur-sm opacity-50 group-hover:opacity-80 transition-opacity"
              />
              <div className="relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-sm font-semibold text-white shadow-md shadow-emerald-700/30 transition-all hover:from-emerald-700 hover:via-teal-700 hover:to-sky-700">
                <Plus className="h-5 w-5" /> Schedule event
              </div>
            </button>

            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md"
              />
              <Card className="border border-emerald-100/60 bg-white/75 backdrop-blur-xl shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] overflow-hidden rounded-2xl">
                <CardHeader className="bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-transparent border-b border-emerald-100/40 pb-3">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-emerald-600" /> Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5">
                  {CATEGORIES.map((cat) => {
                    const count = events.filter(
                      (e) => e.category === cat.name,
                    ).length;
                    return (
                      <div
                        key={cat.name}
                        className="flex items-center justify-between group cursor-pointer rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-emerald-50/40"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm",
                              cat.color,
                            )}
                          />
                          <span className="text-xs font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">
                            {cat.name}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-200/60 bg-emerald-50/70 text-emerald-700 font-bold"
                        >
                          {count}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md"
              />
              <Card className="border border-emerald-100/60 bg-white/75 backdrop-blur-xl shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] overflow-hidden rounded-2xl">
                <CardHeader className="bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-transparent border-b border-emerald-100/40 pb-3">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" /> Upcoming
                    Soon
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-emerald-50/60">
                    {events.slice(0, 4).map((e, i) => (
                      <div
                        key={i}
                        className="px-4 py-3 transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                      >
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {e.title}
                        </p>
                        <p className="text-[10px] text-emerald-600/80 font-semibold mt-0.5">
                          {format(new Date(e.start_time), "MMM d, HH:mm")}
                        </p>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                          <Clock className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-700">
                          No future events scheduled
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-2xl border shadow-sm gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="rounded-xl border"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-black tracking-tight min-w-[150px] text-center">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="rounded-xl border"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="ml-2 rounded-xl text-xs font-bold px-4"
              >
                Today
              </Button>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl backdrop-blur-sm border border-slate-200/50">
              {(["month", "week", "day"] as const).map((v) => {
                const isActive = view === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      "rounded-lg text-xs font-bold uppercase tracking-wider h-8 px-4 transition-all capitalize",
                      isActive
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {view === "month" && renderMonthView()}
            {view === "week" && renderWeekView()}
            {view === "day" && renderDayView()}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] w-[calc(100%-2rem)] rounded-3xl p-0 overflow-hidden border border-emerald-200/60 bg-white/90 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(15,118,110,0.5)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 px-6 py-6 sm:px-8 sm:py-8 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="pointer-events-none absolute -top-12 -right-8 h-40 w-40 rounded-full bg-white/15 blur-2xl animate-pulse [animation-duration:6s]" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/30 shadow-md">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <DialogHeader className="text-left">
                <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 mb-1.5 w-fit">
                  <Sparkles className="h-2.5 w-2.5" />
                  {isEditing ? "Editing" : "New event"}
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  {isEditing ? "Edit event" : "Schedule new event"}
                </DialogTitle>
                <p className="text-emerald-50/90 text-xs mt-0.5">
                  {isEditing
                    ? "Update your event details below."
                    : "Fill in the details to add to your agenda."}
                </p>
              </DialogHeader>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 space-y-5 bg-white">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Event title
              </label>
              <Input
                placeholder="Ex: Weekly Team Review"
                className="h-11 rounded-xl border-slate-200 bg-white/80 backdrop-blur-md focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300"
                value={newEvent.title}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, title: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Start time
                </label>
                <Input
                  type="datetime-local"
                  className="h-11 rounded-xl border-slate-200 bg-white/80 backdrop-blur-md text-xs sm:text-sm focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300 w-full"
                  value={newEvent.start_time}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, start_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  End time
                </label>
                <Input
                  type="datetime-local"
                  className="h-11 rounded-xl border-slate-200 bg-white/80 backdrop-blur-md text-xs sm:text-sm focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300 w-full"
                  value={newEvent.end_time}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, end_time: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const isActive = newEvent.category === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() =>
                        setNewEvent({ ...newEvent, category: cat.name as any })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                        isActive
                          ? cn(
                              cat.color,
                              "text-white border-transparent shadow-md ring-2 ring-white/40",
                            )
                          : "bg-white/80 text-slate-600 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isActive ? "bg-white/80" : cat.color,
                        )}
                      />
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Description (optional)
              </label>
              <Input
                placeholder="Add more context…"
                className="h-11 rounded-xl border-slate-200 bg-white/80 backdrop-blur-md focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300"
                value={newEvent.description}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, description: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 bg-white flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-6 h-11 text-xs font-bold uppercase tracking-wider text-slate-600 transition-all hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-700 w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEvent}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="group relative inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-8 h-11 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-700/30 transition-all hover:from-emerald-700 hover:via-teal-700 hover:to-sky-700 disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isEditing
                ? updateMutation.isPending
                  ? "Updating…"
                  : "Update Event"
                : createMutation.isPending
                  ? "Scheduling…"
                  : "Create Event"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Details / Delete Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedEvent && (
            <>
              <div
                className={cn(
                  "p-8 text-white relative",
                  CATEGORIES.find((c) => c.name === selectedEvent.category)
                    ?.color || "bg-emerald-600",
                )}
              >
                <div className="absolute top-4 right-4 opacity-10">
                  <CalendarIcon className="h-20 w-20" />
                </div>
                <DialogHeader>
                  <Badge
                    variant="outline"
                    className="w-fit mb-2 bg-white/20 border-white/30 text-white font-bold"
                  >
                    {selectedEvent.category}
                  </Badge>
                  <DialogTitle className="text-2xl font-black tracking-tight leading-tight">
                    {selectedEvent.title}
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black tracking-widest text-slate-400">
                      Starts
                    </p>
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {format(
                        new Date(selectedEvent.start_time),
                        "MMM d, HH:mm",
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black tracking-widest text-slate-400">
                      Ends
                    </p>
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {format(new Date(selectedEvent.end_time), "MMM d, HH:mm")}
                    </div>
                  </div>
                </div>

                {selectedEvent.description && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black tracking-widest text-slate-400">
                      Description
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-2xl h-12 font-bold text-slate-500 hover:bg-slate-100"
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl h-12 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                    onClick={handleEditClick}
                  >
                    Edit
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl h-12 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-bold gap-2 shadow-sm transition-all hover:shadow-md"
                    onClick={() => deleteMutation.mutate(selectedEvent.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CalendarPage;
