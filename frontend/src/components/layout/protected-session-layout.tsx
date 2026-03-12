import { SessionProviders } from "@/components/session-providers";
import { getAuthUser, getMenuTree } from "@/lib/server/session";

export async function ProtectedSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [initialUser, initialMenus] = await Promise.all([getAuthUser(), getMenuTree()]);

  return (
    <SessionProviders initialUser={initialUser} initialMenus={initialMenus}>
      {children}
    </SessionProviders>
  );
}
