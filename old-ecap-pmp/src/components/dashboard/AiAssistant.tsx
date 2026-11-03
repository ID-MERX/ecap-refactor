import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Sparkles,
  Send,
  X,
  MessageSquare,
  User,
  Bot,
  Loader2,
  Maximize2,
  Minimize2,
  Trash2,
  HelpCircle,
  FileText,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAiResponse, getAiGreeting, Message } from "@/lib/ai-service";
import { playDrop } from "@/lib/sounds";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const SUGGESTIONS = [
  { label: "VCA Registration", icon: User, query: "Show me the steps to register a new VCA child in the system." },
  { label: "Data Flag System", icon: AlertTriangle, query: "Explain what flagged records are and why they appear." },
  { label: "Household Services", icon: FileText, query: "What types of services can I record for a household?" },
  { label: "ECAP+ Quick Tour", icon: HelpCircle, query: "Give me a quick tour of the system's main features." },
];

export const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem("ai_assistant_open") === "true");
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    localStorage.setItem("ai_assistant_open", String(isOpen));
  }, [isOpen]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAuth();
  const { updateColor, resetTheme } = useTheme();

  const ALLOWED_TARGETS = [
    "banner", "sidebar", "header", "background", "button", "card", "text", "theme"
  ];

  // No longer draggable, fixed to bottom-right
  const userName = user?.first_name || "there";

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = async (customInput?: string) => {
    const textToSend = customInput || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: textToSend.trim() };
    setMessages(prev => [...prev, userMessage]);
    if (!customInput) setInput("");
    setIsLoading(true);

    try {
      const currentPage = document.title.split("-")[0].trim() || "Dashboard";
      const response = await getAiResponse([...messages, userMessage], currentPage);

      // Process potential JSON commands
      let cleanContent = response;
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);

      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[1]);
          if (command.action === "change_color" && ALLOWED_TARGETS.includes(command.target)) {
            // Apply the color change
            updateColor(command.target as any, command.value);
            // Clean up the response text to hide the JSON block from the user
            cleanContent = response.replace(/```json\n[\s\S]*?\n```/, "").trim();
            if (!cleanContent) {
              cleanContent = `I've updated the ${command.target} color to ${command.value} for you!`;
            }
          } else if (command.action && command.action !== "change_color") {
            cleanContent = "I am only restricted to color changes.";
          }
        } catch (e) {
          console.error("Failed to parse AI command", e);
        }
      }

      const assistantMessage: Message = { role: "assistant", content: cleanContent };
      setMessages(prev => [...prev, assistantMessage]);
      playDrop();
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm having a brief connection issue. Please try again in a moment."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const storageKey = user?.id ? `ecap.chat_history.${user.id}` : "ecap.chat_history.guest";

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  };

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse chat history");
      }
    } else {
      setMessages([]); // Clear if no history for this user
    }
  }, [storageKey]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  // Live AI greeting on first open per session. Replaces the static "Hello"
  // panel with a freshly generated message from the local Ollama model.
  // Tracks a per-user snapshot of last-visit metadata in localStorage so
  // returning users get a "welcome back — N days, X new things" summary
  // instead of an empty greeting.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || greetedRef.current) return;
    if (messages.length > 0) {
      greetedRef.current = true;
      return;
    }
    greetedRef.current = true;
    const userId = user?.id || (user as any)?.email || "guest";
    const firstName = user?.first_name || "there";
    const role = (user as any)?.role?.name || (typeof (user as any)?.role === "string" ? (user as any).role : "user");
    const snapshotKey = `bumi.snapshot.${userId}`;
    const currentSnap = { ts: Date.now() };
    let priorSnap: { ts: number } | null = null;
    try {
      const raw = localStorage.getItem(snapshotKey);
      if (raw) priorSnap = JSON.parse(raw);
    } catch { /* ignore */ }

    let awayLabel: string | undefined;
    let isReturning = false;
    if (priorSnap?.ts) {
      isReturning = true;
      const mins = Math.max(0, Math.round((Date.now() - priorSnap.ts) / 60000));
      const days = Math.floor(mins / (60 * 24));
      const hours = Math.floor((mins % (60 * 24)) / 60);
      awayLabel = days >= 1 ? `${days} day${days === 1 ? "" : "s"}`
        : hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"}`
        : `${mins} minute${mins === 1 ? "" : "s"}`;
    }
    try { localStorage.setItem(snapshotKey, JSON.stringify(currentSnap)); } catch { /* ignore */ }

    setIsLoading(true);
    getAiGreeting({
      firstName,
      role,
      isReturning,
      awayLabel,
      liveSummary: `Platform: ECAP+ PMP. Current page: ${location.pathname}.`,
      diffSummary: isReturning ? `User last opened the platform ${awayLabel} ago.` : undefined,
    })
      .then((text) => {
        setMessages([{ role: "assistant", content: text || `Hi ${firstName} — ask me anything about ECAP+.` }]);
        playDrop();
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: `Hi ${firstName} — local agent is warming up. Ask me anything about ECAP+.` }]);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-4 font-sans"
    >
      {/* Chat Window */}
      {isOpen && (
        <Card className={cn(
          "absolute right-0 w-[calc(100%-32px)] sm:w-[380px] border-slate-200 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-500 animate-in slide-in-from-bottom-5 overflow-hidden ring-1 ring-slate-200/50 pb-2",
          isMinimized ? "h-14" : "h-[480px] sm:h-[600px]",
          "bottom-full mb-4"
        )}>
          {/* Refined Header: Slimmer & Less Saturated */}
          <CardHeader className={cn(
            "flex flex-row items-center justify-between px-4 py-3 transition-all duration-500 select-none",
            "bg-slate-50 border-b border-slate-100 text-slate-900"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 ring-1 ring-emerald-600/20">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-xs font-bold tracking-wide text-slate-800">Bumi AI Agent</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500 font-medium">System intelligence</span>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                onClick={clearChat}
                title="Start New Chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="p-0">
                <ScrollArea ref={scrollRef} className="h-[320px] sm:h-[430px] p-4">
                  {/* When the chat is empty AND not currently waiting on
                      the live greeting, show only the suggestion shortcuts
                      (the welcome message itself comes from the AI). */}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col space-y-6 pt-2 px-1">
                      <div className="space-y-6">

                        <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                          <p className="text-[10px] font-bold tracking-widest text-slate-400 mb-1 ml-1 px-1">Common queries</p>
                          {SUGGESTIONS.map((s, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              onClick={() => handleSend(s.query)}
                              className="w-full justify-start gap-4 h-auto py-3.5 px-4 bg-white border-slate-100 rounded-xl hover:bg-slate-50 hover:border-emerald-200/50 hover:text-emerald-700 transition-all group whitespace-normal text-left shadow-sm active:scale-[0.98]"
                            >
                              <div className="shrink-0 p-1.5 rounded-lg bg-slate-50 group-hover:bg-emerald-50 transition-colors">
                                <s.icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-600" />
                              </div>
                              <span className="text-[13px] font-medium leading-tight">{s.label}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message Stream */}
                  <div className="flex flex-col space-y-7">
                    {messages.map((m, i) => (
                      <div key={i} className={cn(
                        "flex items-start gap-3",
                        m.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}>
                        <div className={cn(
                          "mt-1 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg ring-1",
                          m.role === "user" ? "bg-slate-100 ring-slate-200" : "bg-emerald-50 ring-emerald-100"
                        )}>
                          {m.role === "user" ? <User className="h-3.5 w-3.5 text-slate-500" /> : <Bot className="h-3.5 w-3.5 text-emerald-600" />}
                        </div>
                        <div className={cn(
                          "max-w-[82%] rounded-xl px-4 py-3 leading-relaxed text-[13px] transition-all",
                          m.role === "user"
                            ? "bg-emerald-600 text-white shadow-sm border border-emerald-500"
                            : cn(
                              "bg-slate-50 border border-slate-100 shadow-sm text-slate-800",
                              m.content.includes("trouble") ? "bg-amber-50/50 border-amber-100 text-amber-900" : ""
                            )
                        )}>
                          {m.role === "assistant" && m.content.includes("trouble") && (
                            <Info className="h-4 w-4 mb-2 text-amber-600" />
                          )}
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex items-start gap-3">
                        <div className="mt-1 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
                          <Bot className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-400 flex items-center gap-2 shadow-sm text-[13px]">
                          <Loader2 className="h-3 w-3 animate-spin" /> Transmitting...
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Improved Footer: Clear Separation & Prominent Input */}
              <CardFooter className="p-4 border-t border-slate-100 bg-white">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex w-full flex-col gap-3"
                >
                  <div className="flex items-center gap-3 px-1">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-1.5 font-bold tracking-widest transition-colors w-fit"
                    >
                      <X className="h-3 w-3" /> Close chat
                    </button>
                    <span className="text-[10px] text-slate-300 font-medium tracking-[0.2em] ml-auto"></span>
                  </div>

                  <div className="group relative flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 border border-slate-200 transition-all focus-within:border-emerald-500/30 focus-within:ring-4 focus-within:ring-emerald-500/5 shadow-inner">
                    <Input
                      placeholder="Ask anything..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isLoading}
                      className="flex-1 h-9 bg-transparent border-none shadow-none focus-visible:ring-0 text-sm py-0 pl-2"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isLoading || !input.trim()}
                      className={cn(
                        "h-8 w-8 rounded-lg transition-all duration-300 shrink-0 shadow-sm",
                        input.trim()
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] shadow-emerald-500/20"
                          : "bg-slate-200 text-slate-400"
                      )}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      )}

      {/* Floating Toggle Button: Professional Glow */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
          className="group relative h-14 w-14 rounded-full bg-white p-0 shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 border border-slate-200 select-none"
        >
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <Bot className="h-6 w-6 text-slate-700 transition-colors group-hover:text-emerald-700" />
              <div className="absolute -right-2 -top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 animate-in zoom-in duration-300 shadow-sm ring-2 ring-white">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
            </div>
          </div>
        </Button>
      )}
    </div>
  );
};
