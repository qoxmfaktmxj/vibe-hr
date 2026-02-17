import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME = "vibe_hr_token";

export default async function Home() {
  const cookieStore = await cookies();
  const hasAuthToken = Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (hasAuthToken) {
    redirect("/dashboard");
  }

  redirect("/login");
}
