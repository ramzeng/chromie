#!/usr/bin/env bash

set -euo pipefail

umask 077

usage() {
  cat <<'EOF'
Usage: scripts/repack-p12-for-ci.sh INPUT.p12 [OUTPUT.p12]

Repackages a legacy PKCS#12 certificate without RC2 for macOS CI signing.
The output defaults to INPUT-ci.p12 and existing files are never overwritten.

Optional environment variables for non-interactive use:
  CHROMIE_P12_OLD_PASSWORD  Password of the input file
  CHROMIE_P12_NEW_PASSWORD  Password to set on the output file
  OPENSSL_BIN               OpenSSL 3 executable (default: auto-detect)
EOF
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

supports_legacy_pkcs12() {
  local candidate=$1
  local help_output

  help_output=$("$candidate" pkcs12 -help 2>&1 || true)
  [[ "$help_output" == *'-legacy'* ]]
}

find_openssl() {
  local candidate
  local brew_prefix

  if [[ -n "${OPENSSL_BIN:-}" ]]; then
    command -v "$OPENSSL_BIN" >/dev/null 2>&1 || fail "OPENSSL_BIN is not executable: $OPENSSL_BIN"
    supports_legacy_pkcs12 "$OPENSSL_BIN" || fail "OPENSSL_BIN must support 'pkcs12 -legacy': $OPENSSL_BIN"
    printf '%s' "$OPENSSL_BIN"
    return
  fi

  candidate=$(command -v openssl || true)
  if [[ -n "$candidate" ]] && supports_legacy_pkcs12 "$candidate"; then
    printf '%s' "$candidate"
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    brew_prefix=$(brew --prefix openssl@3 2>/dev/null || true)
    candidate="$brew_prefix/bin/openssl"
    if [[ -n "$brew_prefix" && -x "$candidate" ]] && supports_legacy_pkcs12 "$candidate"; then
      printf '%s' "$candidate"
      return
    fi
  fi

  fail "OpenSSL 3 is required. Install it with 'brew install openssl@3'."
}

prompt_password() {
  local prompt=$1
  local password

  IFS= read -r -s -p "$prompt" password
  printf '\n' >&2
  printf '%s' "$password"
}

if [[ "${1:-}" == '-h' || "${1:-}" == '--help' ]]; then
  usage
  exit 0
fi

[[ $# -ge 1 && $# -le 2 ]] || {
  usage >&2
  exit 2
}

input_path=$1
if [[ $# -eq 2 ]]; then
  output_path=$2
elif [[ "$input_path" == *.p12 ]]; then
  output_path="${input_path%.p12}-ci.p12"
else
  output_path="${input_path}-ci.p12"
fi

[[ -f "$input_path" && -r "$input_path" ]] || fail "input file is not readable: $input_path"
[[ ! -e "$output_path" && ! -L "$output_path" ]] || fail "output already exists: $output_path"

output_dir=$(dirname -- "$output_path")
output_name=$(basename -- "$output_path")
[[ -d "$output_dir" && -w "$output_dir" ]] || fail "output directory is not writable: $output_dir"

openssl_bin=$(find_openssl)
printf 'Using %s\n' "$("$openssl_bin" version)"

old_password=${CHROMIE_P12_OLD_PASSWORD:-}
if [[ -z "$old_password" ]]; then
  old_password=$(prompt_password 'Input .p12 password: ')
fi
[[ -n "$old_password" ]] || fail 'input password cannot be empty'

new_password=${CHROMIE_P12_NEW_PASSWORD:-}
if [[ -z "$new_password" ]]; then
  new_password=$(prompt_password 'New .p12 password: ')
  confirmed_password=$(prompt_password 'Confirm new password: ')
  [[ "$new_password" == "$confirmed_password" ]] || fail 'new passwords do not match'
  unset confirmed_password
fi
[[ -n "$new_password" ]] || fail 'new password cannot be empty'

export CHROMIE_P12_OLD_PASSWORD="$old_password"
export CHROMIE_P12_NEW_PASSWORD="$new_password"

temporary_output=''
validation_dir=''
validation_keychain=''
cleanup() {
  unset CHROMIE_P12_OLD_PASSWORD CHROMIE_P12_NEW_PASSWORD old_password new_password
  if [[ -n "$validation_keychain" && -f "$validation_keychain" ]]; then
    /usr/bin/security delete-keychain "$validation_keychain" >/dev/null 2>&1 || true
  fi
  if [[ -n "$validation_dir" && -d "$validation_dir" ]]; then
    /bin/rm -rf -- "$validation_dir"
  fi
  if [[ -n "$temporary_output" && -f "$temporary_output" ]]; then
    /bin/rm -f -- "$temporary_output"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

temporary_output=$(mktemp "$output_dir/.${output_name}.tmp.XXXXXX")

# The private key and certificate chain are decrypted into separate in-memory
# file descriptors. No unencrypted PEM file is written to disk. Both the key and
# certificates use 3DES because macOS Security imports it reliably without RC2.
"$openssl_bin" pkcs12 \
  -export \
  -inkey <(
    "$openssl_bin" pkcs12 \
      -legacy \
      -in "$input_path" \
      -passin env:CHROMIE_P12_OLD_PASSWORD \
      -nocerts \
      -noenc |
      "$openssl_bin" pkey
  ) \
  -in <(
    "$openssl_bin" pkcs12 \
      -legacy \
      -in "$input_path" \
      -passin env:CHROMIE_P12_OLD_PASSWORD \
      -nokeys |
      awk '
        /-----BEGIN CERTIFICATE-----/ { copying = 1 }
        copying { print }
        /-----END CERTIFICATE-----/ { copying = 0 }
      '
  ) \
  -out "$temporary_output" \
  -passout env:CHROMIE_P12_NEW_PASSWORD \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-3DES \
  -macalg SHA1 \
  -iter 2048 \
  -nomaciter

inspection=''
if ! inspection=$("$openssl_bin" pkcs12 \
  -in "$temporary_output" \
  -passin env:CHROMIE_P12_NEW_PASSWORD \
  -info \
  -noout 2>&1); then
  fail "converted file failed validation: $inspection"
fi

[[ "$inspection" != *'RC2'* ]] || fail 'converted file still contains RC2 encryption'

[[ -x /usr/bin/security ]] || fail 'macOS security command is required for final validation'
validation_dir=$(mktemp -d "${TMPDIR:-/tmp}/chromie-p12-validation.XXXXXX")
validation_keychain="$validation_dir/validation.keychain-db"
validation_keychain_password=$("$openssl_bin" rand -base64 32)
/usr/bin/security create-keychain -p "$validation_keychain_password" "$validation_keychain"

security_output=''
if ! security_output=$(/usr/bin/security import \
  "$temporary_output" \
  -k "$validation_keychain" \
  -f pkcs12 \
  -P "$new_password" \
  -T /usr/bin/codesign \
  -T /usr/bin/productbuild 2>&1); then
  fail "macOS Keychain rejected the converted file: $security_output"
fi
unset security_output validation_keychain_password

/usr/bin/security delete-keychain "$validation_keychain"
validation_keychain=''
/bin/rmdir "$validation_dir"
validation_dir=''

[[ ! -e "$output_path" && ! -L "$output_path" ]] || fail "output was created while converting: $output_path"
/bin/mv "$temporary_output" "$output_path"
temporary_output=''
chmod 600 "$output_path"

printf '\nCreated CI-compatible certificate:\n  %s\n' "$output_path"
printf '\nNext, copy its Base64 value into the MAC_CSC_LINK secret:\n  base64 -i %q | tr -d "\\n" | pbcopy\n' "$output_path"
printf 'Set MAC_CSC_KEY_PASSWORD to the new password entered above.\n'
