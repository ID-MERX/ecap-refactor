import { useState, useRef } from "react";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileAttachmentProps {
  onFileSelect: (file: File) => void;
  onCancel: () => void;
}

export const FileAttachment = ({ onFileSelect, onCancel }: FileAttachmentProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSend = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
      setSelectedFile(null);
      setPreview(null);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreview(null);
    onCancel();
  };

  if (selectedFile) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-40 rounded" />
        ) : (
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <FileText className="h-5 w-5 text-slate-400" />
            <span className="text-sm truncate flex-1">{selectedFile.name}</span>
            <span className="text-xs text-slate-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSend} className="flex-1">
            Send File
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => fileInputRef.current?.click()}
        title="Attach file"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
};
