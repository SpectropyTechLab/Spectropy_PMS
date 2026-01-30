import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { User, Save, Camera, Loader2 } from "lucide-react";
import type { User as UserType } from "@shared/schema";

export default function Account() {
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const currentUser = users.find((u) => u.id === Number(userId));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [avatar, setAvatar] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setEmail(currentUser.email || "");
      setTitle(currentUser.title || "");
      setAvatar(currentUser.avatar || "");
    }
  }, [currentUser]);

  const { uploadFile, isUploading } = useUpload({
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload your photo.",
        variant: "destructive",
      });
    },
  });

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Only images allowed",
        description: "Choose a PNG, JPG, or GIF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 10MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const response = await uploadFile(file, { folder: "logo" });
    if (!response) {
      event.target.value = "";
      return;
    }

    const nextAvatar = response.publicUrl || response.objectPath;
    setAvatar(nextAvatar);
    toast({
      title: "Photo uploaded",
      description: "Click Save Changes to update your profile.",
    });
    event.target.value = "";
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserType>) => {
      return apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (name) localStorage.setItem("userName", name);
      if (avatar) localStorage.setItem("userAvatar", avatar);
      toast({
        title: "Account Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update your profile.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, email, title, avatar });
  };

  if (!currentUser) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 md:gap-3">
          <User className="w-6 h-6 md:w-8 md:h-8 text-primary" />
          Account Settings
        </h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base">
          Manage your profile and account preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal details and profile picture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatar || currentUser.avatar || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {(name || currentUser.name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label htmlFor="avatar">Profile Picture URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="avatar"
                    placeholder="https://example.com/avatar.png"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    data-testid="input-avatar"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-avatar"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                  disabled={isUploading}
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Project Manager, Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={currentUser.role}
                  disabled
                  className="bg-slate-50"
                  data-testid="input-role"
                />
                <p className="text-xs text-muted-foreground">
                  Role can only be changed by an administrator
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-save-account"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
