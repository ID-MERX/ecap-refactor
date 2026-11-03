import { useState, useRef } from "react";
import { Camera, Upload, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uploadFile, updateUserAvatar, getFileUrl } from "@/lib/directus";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProfilePictureModalProps {
  userId: string;
  currentAvatarUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditable?: boolean;
}

export const ProfilePictureModal = ({
  userId,
  currentAvatarUrl,
  open,
  onOpenChange,
  isEditable = false,
}: ProfilePictureModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const isMe = user?.id === userId;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const uploadedFile = await uploadFile(selectedFile);
      await updateUserAvatar(userId, uploadedFile.id);

      queryClient.invalidateQueries({ queryKey: ["users-list-chat"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });

      toast.success("Profile picture updated!");
      await refreshProfile();
      onOpenChange(false);
      setSelectedFile(null);
      setPreview(null);
    } catch (error) {
      toast.error("Failed to upload profile picture");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete your profile picture?")) return;

    setUploading(true);
    try {
      await updateUserAvatar(userId, null);
      queryClient.invalidateQueries({ queryKey: ["users-list-chat"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Profile picture removed");
      await refreshProfile();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditable ? "Update Profile Picture" : "Profile Picture"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex justify-center">
            {preview || currentAvatarUrl ? (
              <div className="relative">
                <img
                  src={preview || currentAvatarUrl}
                  alt="Profile"
                  className="w-48 h-48 rounded-full object-cover border-4 border-slate-100 shadow-xl"
                />
                {preview && isEditable && (
                  <button
                    onClick={() => {
                      setPreview(null);
                      setSelectedFile(null);
                    }}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="w-48 h-48 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200">
                <Camera className="h-16 w-16 text-slate-300" />
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />

          {isEditable && (
            <div className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {preview ? "Change Photo" : "Choose Photo"}
                </Button>
                <Button
                  className="flex-1 rounded-xl h-11 bg-slate-900 hover:bg-slate-800"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? "Saving..." : "Save Picture"}
                </Button>
              </div>

              {currentAvatarUrl && !preview && (
                <Button
                  variant="ghost"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                  onClick={handleDelete}
                  disabled={uploading}
                >
                  Delete Current Photo
                </Button>
              )}
            </div>
          )}

          {isMe && !isEditable && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-3">
                To manage your identity and profile picture, please visit your account settings.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-lg text-xs font-bold gap-2"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/profile");
                }}
              >
                <Settings className="h-3 w-3" />
                Go to Account Settings
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
