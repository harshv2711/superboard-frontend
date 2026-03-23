import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { superboardApi } from "@/api/superboardApi";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function getDefaultRouteForRole(role) {
  if (role === "superuser") return "/account-planing";
  if (role === "account_planner") return "/account-planing";
  if (role === "art_director") return "/art-director";
  if (role === "designer") return "/designer";
  return "/account-planing";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await superboardApi.auth.register({
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      navigate(getDefaultRouteForRole(response?.role), { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>Create your account with the API registration endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-first-name">First name</Label>
                  <Input
                    id="register-first-name"
                    value={form.first_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-last-name">Last name</Label>
                  <Input
                    id="register-last-name"
                    value={form.last_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
