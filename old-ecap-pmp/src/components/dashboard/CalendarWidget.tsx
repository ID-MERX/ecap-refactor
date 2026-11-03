import { useQuery } from "@tanstack/react-query";
import { getCalendarEvents } from "@/lib/directus";
import { useAuth } from "@/context/AuthContext";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { format, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const CalendarWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events-widget", user?.id],
    queryFn: () => getCalendarEvents(user?.id || ""),
    enabled: !!user?.id,
  });

  const todaysEvents = events.filter(e => isToday(new Date(e.start_time)));

  return (
    <GlowCard className="h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-bold">Upcoming Schedule</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Your scheduled events and meetings</p>
        </div>
        <Calendar className="h-5 w-5 text-emerald-600 opacity-50" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingDots />
            </div>
          ) : todaysEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-medium">No events for today</p>
              <button
                onClick={() => navigate("/calendar")}
                className="mt-2 text-[10px] font-bold tracking-widest text-emerald-600 hover:text-emerald-700"
              >
                Schedule now
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate("/calendar")}
                  className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-emerald-200 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                      "w-1 h-8 rounded-full shrink-0",
                      event.category === "Meeting" ? "bg-emerald-500" :
                        event.category === "Field Visit" ? "bg-emerald-500" :
                          event.category === "Deadline" ? "bg-rose-500" : "bg-amber-500"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{event.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.start_time), "HH:mm")} - {format(new Date(event.end_time), "HH:mm")}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate("/calendar")}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-[10px] font-bold tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
          >
            View full calendar
          </button>
        </div>
      </CardContent>
    </GlowCard>
  );
};

export default CalendarWidget;
