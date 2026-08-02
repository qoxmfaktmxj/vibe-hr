#!/usr/bin/env bash

set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$repository_root/scripts/spring-migration/load-deploy-env.sh"

assert_invalid_secret() {
  local description="$1" value="$2"
  if is_valid_deploy_secret "$value"; then
    printf '[deploy-security] accepted invalid %s\n' "$description" >&2
    exit 1
  fi
}

assert_valid_secret() {
  local description="$1" value="$2"
  if ! is_valid_deploy_secret "$value"; then
    printf '[deploy-security] rejected valid %s\n' "$description" >&2
    exit 1
  fi
}

assert_invalid_secret "blank secret" ""
assert_invalid_secret "whitespace secret" "4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bc c65"
assert_invalid_secret "BOM secret" $'4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc65\uFEFF'
assert_invalid_secret "control character secret" $'4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc65\u0001'
assert_invalid_secret "format character secret" $'4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc65\u200B'
assert_invalid_secret "short secret" "short-secret"
assert_invalid_secret "repeated secret" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
assert_invalid_secret "password secret" "passwordpasswordpasswordpasswordpasswordpasswordpasswordpassword"
assert_invalid_secret "short hexadecimal secret" "4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc6"
for placeholder in change-me replace-me replace-with placeholder example default; do
  assert_invalid_secret "${placeholder} placeholder" "${placeholder}-000000000000000000000000000000000000000000000000000000"
  assert_invalid_secret "uppercase ${placeholder} placeholder" "${placeholder^^}-000000000000000000000000000000000000000000000000000000"
done
auth_secret="4d1de25bfbc17cbeb6db0b7092627727d92879999a3be8a2442c7b2af87bcc65"
bff_secret="083b547e0d865594d4006199e1abdd191696523975e15050039ba2faa5e27a6a"
assert_valid_secret "256-bit hexadecimal auth secret" "$auth_secret"
assert_valid_secret "256-bit hexadecimal BFF secret" "$bff_secret"
if ! are_distinct_deploy_secrets "$auth_secret" "$bff_secret"; then
  printf '[deploy-security] distinct generated secrets were rejected\n' >&2
  exit 1
fi
if are_distinct_deploy_secrets "$auth_secret" "$auth_secret"; then
  printf '[deploy-security] matching AUTH and BFF secrets were accepted\n' >&2
  exit 1
fi

load_deploy_env "$repository_root/.env.deploy.secret.example"
assert_invalid_secret "AUTH_TOKEN_SECRET example" "$AUTH_TOKEN_SECRET"
assert_invalid_secret "VIBEHR_BFF_ASSERTION_SECRET example" "$VIBEHR_BFF_ASSERTION_SECRET"

load_deploy_env "$repository_root/.env.deploy"
if [[ "$VIBEHR_BFF_TRUSTED_CLIENT_IP_HEADER" != "x-vibehr-client-ip" ]]; then
  printf '[deploy-security] deployment must require the fixed sanitized client IP header\n' >&2
  exit 1
fi

printf 'Deploy secret validation behavior passed.\n'
