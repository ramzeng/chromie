#!/usr/bin/env bash

set -euo pipefail

command_name="${1:-}"
app_path="${2:-}"
wait_timeout="${NOTARY_WAIT_TIMEOUT:-25m}"

usage() {
  cat >&2 <<'EOF'
Usage:
  notarize-macos.sh validate
  notarize-macos.sh submit /path/to/App.app
  NOTARY_SUBMISSION_ID=<id> notarize-macos.sh wait /path/to/App.app
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command is unavailable: $1" >&2
    exit 1
  fi
}

require_environment() {
  : "${APPLE_API_KEY:?APPLE_API_KEY is required}"
  : "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
  : "${APPLE_API_ISSUER:?APPLE_API_ISSUER is required}"

  if [[ ! -f "$APPLE_API_KEY" ]]; then
    echo "Apple API key was not found at the configured path." >&2
    exit 1
  fi
}

prepare_notarytool() {
  require_command xcrun
  require_command jq
  require_environment

  notary_auth_args=(
    --key "$APPLE_API_KEY"
    --key-id "$APPLE_API_KEY_ID"
    --issuer "$APPLE_API_ISSUER"
  )
}

require_app() {
  if [[ -z "$app_path" || ! -d "$app_path" || "$app_path" != *.app ]]; then
    echo "A packaged .app directory is required." >&2
    usage
    exit 1
  fi
}

append_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

download_notarization_log() {
  local submission_id="$1"
  local log_path="${RUNNER_TEMP:-/tmp}/notarization-${submission_id}.json"

  if xcrun notarytool log "${notary_auth_args[@]}" "$submission_id" "$log_path"; then
    echo "Notarization diagnostics:" >&2
    cat "$log_path" >&2
  else
    echo "Unable to download the notarization log for $submission_id." >&2
  fi
}

case "$command_name" in
  validate)
    prepare_notarytool
    echo "Validating Apple notarization credentials..."
    xcrun notarytool history \
      "${notary_auth_args[@]}" \
      --output-format json >/dev/null
    echo "Apple notarization credentials are valid."
    ;;

  submit)
    prepare_notarytool
    require_app
    require_command ditto
    : "${RUNNER_TEMP:?RUNNER_TEMP is required}"

    archive_path="$RUNNER_TEMP/Chromie-notarization.zip"
    cleanup_archive() {
      rm -f -- "$archive_path"
    }
    trap cleanup_archive EXIT

    echo "Creating archive for Apple notarization..."
    rm -f -- "$archive_path"
    ditto -c -k --sequesterRsrc --keepParent "$app_path" "$archive_path"

    echo "Submitting app to Apple notarization service..."
    submission_response="$(
      xcrun notarytool submit "$archive_path" \
        "${notary_auth_args[@]}" \
        --no-wait \
        --output-format json
    )"
    submission_id="$(
      printf '%s' "$submission_response" |
        jq -er '.id | select(type == "string" and length > 0)'
    )"

    echo "Notarization submission ID: $submission_id"
    append_summary "Apple notarization submission: \`$submission_id\`"

    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      printf 'submission_id=%s\n' "$submission_id" >> "$GITHUB_OUTPUT"
    fi
    ;;

  wait)
    prepare_notarytool
    require_app
    : "${NOTARY_SUBMISSION_ID:?NOTARY_SUBMISSION_ID is required}"

    if [[ ! "$wait_timeout" =~ ^[1-9][0-9]*[smh]?$ ]]; then
      echo "Invalid NOTARY_WAIT_TIMEOUT: $wait_timeout" >&2
      exit 1
    fi

    echo "Waiting up to $wait_timeout for notarization submission $NOTARY_SUBMISSION_ID..."
    wait_exit=0
    xcrun notarytool wait "$NOTARY_SUBMISSION_ID" \
      "${notary_auth_args[@]}" \
      --timeout "$wait_timeout" \
      --progress \
      --verbose || wait_exit=$?

    info_response="$(
      xcrun notarytool info "$NOTARY_SUBMISSION_ID" \
        "${notary_auth_args[@]}" \
        --output-format json
    )"
    printf '%s\n' "$info_response"
    notarization_status="$(
      printf '%s' "$info_response" |
        jq -er '.status | select(type == "string" and length > 0)'
    )"

    case "$notarization_status" in
      Accepted)
        echo "Stapling notarization ticket to $app_path..."
        xcrun stapler staple -v "$app_path"
        xcrun stapler validate -v "$app_path"
        append_summary "Apple notarization status: **Accepted**"
        ;;
      "In Progress")
        append_summary "Apple notarization status: **In Progress** after $wait_timeout"
        echo "Notarization is still in progress. Check submission ID $NOTARY_SUBMISSION_ID later." >&2
        exit 124
        ;;
      *)
        append_summary "Apple notarization status: **$notarization_status**"
        download_notarization_log "$NOTARY_SUBMISSION_ID"
        if (( wait_exit != 0 )); then
          exit "$wait_exit"
        fi
        exit 1
        ;;
    esac
    ;;

  *)
    usage
    exit 1
    ;;
esac
