#!/usr/bin/env bash

# The deploy workflow sources this file before validating the operator secret file.
is_valid_deploy_secret() {
  local value="${1:-}" first

  [[ "$value" =~ ^[0-9A-Fa-f]{64}$ ]] || return 1
  first="${value:0:1}"
  [[ -n "${value//"$first"/}" ]]
}

are_distinct_deploy_secrets() {
  is_valid_deploy_secret "${1:-}" && is_valid_deploy_secret "${2:-}" && [[ "$1" != "$2" ]]
}

# Loads simple dotenv files without evaluating their contents as shell code.
load_deploy_env() {
  local file="$1"
  local line line_number=0 key raw_value value
  local dotenv_line='^([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
  local prohibited_substitution='(\$\(|\$\{|\$\[|\$[[:alpha:]_]|`)'
  local -A seen=()

  if [[ ! -r "$file" ]]; then
    printf '[deploy-env] cannot read %s\n' "$file" >&2
    return 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_number += 1))
    line="${line%$'\r'}"
    if [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    if [[ ! "$line" =~ $dotenv_line ]]; then
      printf '[deploy-env] %s:%d must use KEY=VALUE syntax\n' "$file" "$line_number" >&2
      return 1
    fi

    key="${BASH_REMATCH[1]}"
    raw_value="${BASH_REMATCH[2]}"
    if [[ ${seen[$key]+set} ]]; then
      printf '[deploy-env] %s:%d duplicates a key\n' "$file" "$line_number" >&2
      return 1
    fi
    if [[ "$raw_value" == *\\ ]]; then
      printf '[deploy-env] %s:%d does not allow line continuations\n' "$file" "$line_number" >&2
      return 1
    fi
    if [[ "$raw_value" =~ $prohibited_substitution ]]; then
      printf '[deploy-env] %s:%d contains shell substitution syntax\n' "$file" "$line_number" >&2
      return 1
    fi

    if [[ "$raw_value" == '"'* ]]; then
      if [[ ${#raw_value} -lt 2 || "${raw_value: -1}" != '"' ]]; then
        printf '[deploy-env] %s:%d has an unterminated double-quoted value\n' "$file" "$line_number" >&2
        return 1
      fi
      value="${raw_value:1:${#raw_value}-2}"
      if [[ "$value" == *'"'* ]]; then
        printf '[deploy-env] %s:%d has an unsupported quoted value\n' "$file" "$line_number" >&2
        return 1
      fi
    elif [[ "$raw_value" == "'"* ]]; then
      if [[ ${#raw_value} -lt 2 || "${raw_value: -1}" != "'" ]]; then
        printf '[deploy-env] %s:%d has an unterminated single-quoted value\n' "$file" "$line_number" >&2
        return 1
      fi
      value="${raw_value:1:${#raw_value}-2}"
      if [[ "$value" == *"'"* ]]; then
        printf '[deploy-env] %s:%d has an unsupported quoted value\n' "$file" "$line_number" >&2
        return 1
      fi
    elif [[ "$raw_value" == *'"'* || "$raw_value" == *"'"* ]]; then
      printf '[deploy-env] %s:%d has an unsupported quoted value\n' "$file" "$line_number" >&2
      return 1
    else
      value="$raw_value"
    fi

    seen["$key"]=1
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$file"
}
