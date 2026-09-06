export class LoginRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Login request failed.");
    this.name = "LoginRequestError";
    this.status = status;
  }
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "회사 코드, 아이디 또는 비밀번호를 다시 확인해 주세요.";
  }

  if (status === 429) {
    return "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (status >= 500 && status < 600) {
    return "로그인 서비스를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "로그인에 실패했습니다. 다시 시도해 주세요.";
}

export function loginErrorMessageFor(error: unknown): string {
  if (error instanceof LoginRequestError) {
    return messageForStatus(error.status);
  }

  if (error instanceof TypeError) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "로그인 요청이 취소되었습니다. 다시 시도해 주세요.";
  }

  return "로그인에 실패했습니다. 다시 시도해 주세요.";
}

const SOCIAL_LOGIN_ERROR_MESSAGES: Record<string, string> = {
  email_required: "연결할 계정에서 이메일 제공에 동의한 뒤 다시 로그인해 주세요.",
  token_exchange_failed: "간편 로그인을 완료하지 못했습니다. 다시 시도하거나 회사 계정으로 로그인해 주세요.",
  profile_fetch_failed: "계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도하거나 회사 계정으로 로그인해 주세요.",
  invalid_state: "로그인 요청을 확인하지 못했습니다. 로그인 화면에서 다시 시작해 주세요.",
  social_exchange_failed: "간편 로그인을 완료하지 못했습니다. 다시 시도하거나 회사 계정으로 로그인해 주세요.",
  missing_code: "간편 로그인이 완료되지 않았습니다. 로그인 화면에서 다시 시도해 주세요.",
  unsupported_provider: "지원하지 않는 로그인 방식입니다. 구글, 카카오 또는 회사 계정으로 로그인해 주세요.",
  missing_profile_fields: "간편 로그인에 필요한 계정 정보가 없습니다. 회사 계정으로 로그인하거나 사내 계정 관리자에게 문의해 주세요.",
  email_unverified: "연결할 계정의 이메일 인증을 마친 뒤 다시 로그인해 주세요.",
  unexpected: "간편 로그인에 실패했습니다. 다시 시도하거나 회사 계정으로 로그인해 주세요.",
};

export function socialLoginErrorMessageFor(errorCode?: string | null): string | null {
  if (!errorCode) {
    return null;
  }

  return SOCIAL_LOGIN_ERROR_MESSAGES[errorCode] ?? SOCIAL_LOGIN_ERROR_MESSAGES.unexpected;
}
