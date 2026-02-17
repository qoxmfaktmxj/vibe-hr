import { ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldX className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          접근 권한이 없습니다
        </h1>
        <p className="mb-8 text-gray-500">
          이 페이지에 접근할 수 있는 권한이 부여되지 않았습니다.
          <br />
          관리자에게 문의하세요.
        </p>
        <Link href="/dashboard">
          <Button>대시보드로 돌아가기</Button>
        </Link>
      </div>
    </div>
  );
}
