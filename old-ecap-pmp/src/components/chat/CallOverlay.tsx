import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CallState } from "@/hooks/useWebRTC";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFileUrl } from "@/lib/directus";

interface CallOverlayProps {
  state: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  partner: any;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleScreenShare: () => void;
  isScreenSharing: boolean;
}

export const CallOverlay = ({
  state,
  localStream,
  remoteStream,
  partner,
  onAccept,
  onDecline,
  onEnd,
  onToggleScreenShare,
  isScreenSharing
}: CallOverlayProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      // Ensure playback starts reliably
      localVideoRef.current.play().catch(() => {
        // Autoplay might be blocked; ignore silently
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      // Ensure playback starts reliably
      remoteVideoRef.current.play().catch(() => {
        // Autoplay might be blocked; ignore silently
      });
    }
  }, [remoteStream]);

  if (state === "idle") return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
      {/* Partner Info */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-emerald-500/20 shadow-2xl">
          {partner?.avatar && <AvatarImage src={getFileUrl(partner.avatar)} />}
          <AvatarFallback className="text-2xl bg-emerald-600 text-white">
            {partner?.first_name?.[0]}{partner?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-bold text-white mb-1">
          {partner?.first_name} {partner?.last_name}
        </h2>
        <p className="text-slate-400 font-medium">
          {state === "incoming" ? "Incoming call..." :
            state === "outgoing" ? "Calling..." :
              state === "connecting" ? "Connecting..." : "On Call"}
        </p>
      </div>

      {/* Video Streams */}
      <div className="relative w-full max-w-4xl aspect-video bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Local Video (PIP) */}
        <div className="absolute bottom-6 right-6 w-32 sm:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-white/10 ring-1 ring-black/20 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-[10px] text-white font-bold tracking-widest">You</p>
          </div>
        </div>

        {/* Remote Placeholder */}
        {!remoteStream && (state === "active" || state === "connecting" || state === "outgoing") && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <LoaderCircle className="h-12 w-12 text-emerald-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-medium">
                {state === "outgoing" ? "Calling, waiting for video..." : "Establishing secure connection..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-12 flex items-center gap-6 animate-in zoom-in duration-500 delay-200">
        {state === "incoming" ? (
          <>
            <Button
              size="lg"
              onClick={onAccept}
              className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/40 border-none"
            >
              <Phone className="h-7 w-7 text-white" />
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={onDecline}
              className="h-16 w-16 rounded-full bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/40 border-none"
            >
              <PhoneOff className="h-7 w-7 text-white" />
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-4 bg-white/5 p-3 rounded-full backdrop-blur-md ring-1 ring-white/10">
            <Button
              size="icon"
              variant="ghost"
              className="h-14 w-14 rounded-full text-white hover:bg-white/10"
            >
              <Mic className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-14 w-14 rounded-full text-white hover:bg-white/10"
            >
              <Video className="h-6 w-6" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleScreenShare}
              className={cn(
                "h-14 w-14 rounded-full text-white hover:bg-white/10",
                isScreenSharing && "bg-emerald-500/20 ring-2 ring-emerald-400/80"
              )}
              title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
            >
              <Monitor className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={onEnd}
              className="h-16 w-16 rounded-full bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/40 border-none ml-2"
            >
              <PhoneOff className="h-7 w-7 text-white" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Lucide replacement for LoaderCircle if not available
const LoaderCircle = ({ className }: { className?: string }) => (
  <svg
    className={cn("animate-spin", className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
