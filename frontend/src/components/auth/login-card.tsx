import Link from "next/link";
import { Building2, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden border-white/20 bg-white/95 shadow-2xl backdrop-blur dark:bg-slate-900/95">
      {children}
    </Card>
  );
}

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-8 pb-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Building2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-[#111318]">Vibe-HR</h1>
      <p className="text-sm text-slate-500">Welcome back! Please sign in to your account.</p>
    </CardHeader>
  );
}

function AuthCardForm() {
  return (
    <CardContent className="space-y-6 px-8 pb-8 pt-4">
      <form className="space-y-5" action="/dashboard">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-semibold text-slate-700">
            Email Address
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="email"
              name="email"
              type="email"
              className="h-12 border-slate-200 pl-10 text-base"
              placeholder="name@company.com..."
              autoComplete="email"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-semibold text-slate-700">
              Password
            </Label>
            <Link href="/login" className="text-sm font-medium text-primary hover:opacity-80">
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type="password"
              className="h-12 border-slate-200 pl-10 text-base"
              placeholder="Enter your password..."
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-slate-600">
            Keep me signed in
          </Label>
        </div>

        <Button className="h-12 w-full text-base font-bold">Sign In</Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Or continue with
        </span>
      </div>

      <Button variant="outline" className="h-11 w-full border-slate-200 font-semibold text-slate-700">
        Single Sign-On (SSO)
      </Button>
    </CardContent>
  );
}

function AuthCardSupport() {
  return (
    <CardFooter className="border-t border-slate-100 bg-slate-50 px-8 py-5 text-center">
      <p className="w-full text-sm text-slate-500">
        Having trouble logging in?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Contact Admin
        </Link>
      </p>
    </CardFooter>
  );
}

export function LoginCard() {
  return (
    <AuthCard>
      <AuthCardIntro />
      <AuthCardForm />
      <AuthCardSupport />
    </AuthCard>
  );
}

