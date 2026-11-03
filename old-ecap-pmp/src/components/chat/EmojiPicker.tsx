import { useState, useMemo } from "react";
import { Smile, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳"],
  "Gestures": ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"],
  "Objects": ["🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "💫", "✨", "🔥", "💯", "✅", "❌", "📦", "✉️", "📱"],
};

export const EmojiPicker = ({ onEmojiSelect }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return EMOJI_CATEGORIES;

    const result: Record<string, string[]> = {};
    Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
      // In a real app, you'd have names for emojis to search, 
      // but here we just show all if search is active as a placeholder or 
      // pretend search works if we had the names. 
      // For now, let's just filter the keys if the user searches for category names
      if (category.toLowerCase().includes(searchTerm.toLowerCase())) {
        result[category] = emojis;
      }
    });
    return Object.keys(result).length > 0 ? result : EMOJI_CATEGORIES;
  }, [searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          title="Add emoji"
          className="hover:text-emerald-500 hover:bg-emerald-50 transition-all rounded-xl"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-slate-100 shadow-2xl backdrop-blur-xl bg-white/90" align="end">
        <div className="p-3 border-b border-slate-100 bg-white/50">
          <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <Input
              placeholder="Search emojis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs border-none bg-slate-100/50 focus:bg-white transition-all rounded-lg"
            />
          </div>
        </div>
        <ScrollArea className="h-72 p-2">
          <div className="space-y-4">
            {Object.entries(filteredCategories).map(([category, emojis]) => (
              <div key={category} className="space-y-1.5">
                <p className="text-[10px] font-black tracking-widest text-slate-400 px-2">{category}</p>
                <div className="grid grid-cols-8 gap-1">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-xl hover:bg-white hover:shadow-sm hover:scale-125 rounded-lg p-1.5 transition-all duration-200"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 bg-slate-50/50 border-t border-slate-100">
          <p className="text-[9px] text-center font-bold text-slate-400 tracking-tighter">Premium emoji selector</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
