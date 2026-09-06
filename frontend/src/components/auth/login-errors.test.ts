import { expect, test } from "vitest";

import { LoginRequestError, loginErrorMessageFor, socialLoginErrorMessageFor } from "@/components/auth/login-errors";

test("login errors map status codes to safe user guidance", () => {
  expect(loginErrorMessageFor(new LoginRequestError(401))).toBe("회사 코드, 아이디 또는 비밀번호를 다시 확인해 주세요.");
  expect(loginErrorMessageFor(new LoginRequestError(403))).toBe("회사 코드, 아이디 또는 비밀번호를 다시 확인해 주세요.");
  expect(loginErrorMessageFor(new LoginRequestError(429))).toBe("로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.");
  expect(loginErrorMessageFor(new LoginRequestError(503))).toBe(
    "로그인 서비스를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  );
  expect(loginErrorMessageFor(new TypeError("fetch failed"))).toBe("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  expect(loginErrorMessageFor(new Error("unexpected"))).toBe("로그인에 실패했습니다. 다시 시도해 주세요.");
});

test("social login errors describe recovery without technical internals", () => {
  expect(socialLoginErrorMessageFor("email_required")).toContain("이메일 제공에 동의");
  expect(socialLoginErrorMessageFor("unsupported_provider")).toContain("회사 계정으로 로그인");
  expect(socialLoginErrorMessageFor("missing_profile_fields")).toContain("사내 계정 관리자에게 문의");
  expect(socialLoginErrorMessageFor("unknown_error")).toContain("다시 시도");
  expect(socialLoginErrorMessageFor("token_exchange_failed")).not.toContain("토큰");
  expect(socialLoginErrorMessageFor("missing_code")).not.toContain("코드");
  expect(socialLoginErrorMessageFor(null)).toBeNull();
});
