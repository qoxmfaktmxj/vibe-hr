#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/load-deploy-env.sh"

workspace=$(mktemp -d)
trap 'rm -rf "$workspace"' EXIT

cat > "$workspace/valid.env" <<'EOF'
# This file deliberately contains no deployment secret.
PLAIN=value
LITERAL_DOLLAR=literal$123
DOUBLE_QUOTED="two words"
SINGLE_QUOTED='three words'
EOF
load_deploy_env "$workspace/valid.env"
[[ "$PLAIN" == "value" ]]
[[ "$LITERAL_DOLLAR" == 'literal$123' ]]
[[ "$DOUBLE_QUOTED" == "two words" ]]
[[ "$SINGLE_QUOTED" == "three words" ]]

marker="$workspace/should-not-exist"
printf 'MALICIOUS=$(touch %s)\n' "$marker" > "$workspace/malicious.env"
if load_deploy_env "$workspace/malicious.env"; then
  echo "malicious substitution was accepted" >&2
  exit 1
fi
[[ ! -e "$marker" ]]

printf '%s\n' 'export SHOULD_NOT_LOAD=value' > "$workspace/malformed.env"
if load_deploy_env "$workspace/malformed.env"; then
  echo "export syntax was accepted" >&2
  exit 1
fi

echo "Deploy dotenv parser tests passed."
