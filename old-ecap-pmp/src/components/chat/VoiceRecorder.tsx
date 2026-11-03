import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

export const VoiceRecorder = ({ onRecordingComplete, onCancel }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("Failed to access microphone");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  const handleCancel = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border">
        <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1" />
        <Button size="icon" variant="ghost" onClick={handleCancel}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={handleSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-mono text-red-700">{formatTime(recordingTime)}</span>
        </div>
        <Button size="icon" variant="destructive" onClick={stopRecording}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="icon" variant="ghost" onClick={startRecording} title="Record voice note">
      <Mic className="h-4 w-4" />
    </Button>
  );
};
