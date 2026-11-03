import { useEffect, useRef } from "react";
import { getCalendarEvents } from "@/lib/directus";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInMinutes, parseISO } from "date-fns";

export const useCalendarNotifications = () => {
  const { user } = useAuth();
  const notifiedEvents = useRef<Set<string>>(new Set());

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", user?.id], // Standardized key
    queryFn: () => getCalendarEvents(user?.id || ""),
    enabled: !!user?.id,
    refetchInterval: 1000 * 30, // Poll every 30 seconds for better responsiveness
  });

  useEffect(() => {
    // Request permission once on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!events.length) return;

    const now = new Date();

    events.forEach(event => {
      const startTime = parseISO(event.start_time);
      const diff = differenceInMinutes(startTime, now);

      // Trigger notification if event is starting soon (up to 15m) or just started (up to 2m ago)
      const notificationKey = `${event.id}-${event.start_time}`;
      if (diff >= -2 && diff <= 15 && !notifiedEvents.current.has(notificationKey)) {
        notifiedEvents.current.add(notificationKey);

        const isPast = diff < 0;
        const msg = isPast
          ? `${event.title} has just started!`
          : `${event.title} starts in ${diff} minutes!`;

        // Browser Notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(isPast ? "Event Started" : "Upcoming Event", {
            body: msg,
            icon: "/favicon.ico"
          });
        }

        // In-App Toast
        toast.info(isPast ? `Started: ${event.title}` : `Upcoming: ${event.title}`, {
          description: msg,
          duration: 10000,
        });
      }
    });
  }, [events]);
};
