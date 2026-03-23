import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { superboardApi } from "@/api/superboardApi";
import { toast } from "sonner";

const EMPTY_PROFILE_FORM = {
  first_name: "",
  last_name: "",
  email: "",
};

const EMPTY_PASSWORD_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        const me = await superboardApi.auth.me();
        if (cancelled) return;
        setCurrentUser(me);
        setProfileForm({
          first_name: me.first_name || "",
          last_name: me.last_name || "",
          email: me.email || "",
        });
      } catch (requestError) {
        if (cancelled) return;
        setProfileError(requestError.message || "Failed to load account profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    try {
      const updated = await superboardApi.auth.updateProfile({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        email: profileForm.email.trim(),
      });
      setCurrentUser(updated);
      setProfileForm({
        first_name: updated.first_name || "",
        last_name: updated.last_name || "",
        email: updated.email || "",
      });
      toast.success("Profile updated successfully.");
    } catch (requestError) {
      const message = requestError.message || "Failed to update profile.";
      setProfileError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setPasswordError("");

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      const message = "New password and confirm password must match.";
      setPasswordError(message);
      toast.error(message);
      return;
    }

    setSavingPassword(true);
    try {
      await superboardApi.auth.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      toast.success("Password updated successfully.");
    } catch (requestError) {
      const message = requestError.message || "Failed to change password.";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Account" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            {loading ? <p className="text-sm text-muted-foreground">Loading account profile...</p> : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Edit Profile</CardTitle>
                  <CardDescription>Update your first name, last name, and email address.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleSaveProfile}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="account-first-name">First name</Label>
                        <Input
                          id="account-first-name"
                          value={profileForm.first_name}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, first_name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-last-name">Last name</Label>
                        <Input
                          id="account-last-name"
                          value={profileForm.last_name}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, last_name: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-email">Email</Label>
                      <Input
                        id="account-email"
                        type="email"
                        autoComplete="email"
                        value={profileForm.email}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input value={currentUser?.role || "-"} disabled />
                    </div>

                    {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}

                    <Button type="submit" disabled={savingProfile || loading}>
                      {savingProfile ? "Saving..." : "Update Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Use your current password to set a new one.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleChangePassword}>
                    <div className="space-y-2">
                      <Label htmlFor="account-current-password">Current password</Label>
                      <Input
                        id="account-current-password"
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.current_password}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-new-password">New password</Label>
                      <Input
                        id="account-new-password"
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.new_password}
                        onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-confirm-password">Confirm new password</Label>
                      <Input
                        id="account-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirm_password}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))
                        }
                        required
                      />
                    </div>

                    {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}

                    <Button type="submit" disabled={savingPassword || loading}>
                      {savingPassword ? "Updating..." : "Change Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
