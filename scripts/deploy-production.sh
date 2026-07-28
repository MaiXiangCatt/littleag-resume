#!/usr/bin/env bash

set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${repo_dir}/deploy/docker-compose.yml"
env_file="${repo_dir}/.env.prod"
state_dir="${repo_dir}/.deploy"
current_tag_file="${state_dir}/current-image-tag"
requested_tag="${1:-${IMAGE_TAG:-}}"
web_image="${2:-${WEB_IMAGE:-ghcr.io/maixiangcatt/littleag-resume-web}}"
server_image="${3:-${SERVER_IMAGE:-ghcr.io/maixiangcatt/littleag-resume-server}}"
healthcheck_url="${HEALTHCHECK_URL:-http://127.0.0.1:${WEB_HTTP_PORT:-8080}/api/healthz}"
healthcheck_attempts="${HEALTHCHECK_ATTEMPTS:-30}"
healthcheck_interval="${HEALTHCHECK_INTERVAL_SECONDS:-5}"
backup_dir="${BACKUP_DIR:-${repo_dir}/backups}"

if [[ -z "${requested_tag}" && -f "${current_tag_file}" ]]; then
  requested_tag="$(<"${current_tag_file}")"
fi

if [[ ! "${requested_tag}" =~ ^[0-9a-f]{40}$ && "${requested_tag}" != "local" ]]; then
  echo "IMAGE_TAG must be a full 40-character Git commit SHA (or 'local')." >&2
  exit 2
fi
if [[ ! "${web_image}" =~ ^[a-z0-9.-]+(/[a-z0-9._-]+)+$ ]]; then
  echo "Invalid web image reference: ${web_image}" >&2
  exit 2
fi
if [[ ! "${server_image}" =~ ^[a-z0-9.-]+(/[a-z0-9._-]+)+$ ]]; then
  echo "Invalid server image reference: ${server_image}" >&2
  exit 2
fi
if [[ ! -f "${env_file}" ]]; then
  echo "Missing production environment file: ${env_file}" >&2
  exit 2
fi

mkdir -p "${state_dir}"
previous_tag=""
if [[ -f "${current_tag_file}" ]]; then
  previous_tag="$(<"${current_tag_file}")"
fi

export IMAGE_TAG="${requested_tag}"
export WEB_IMAGE="${web_image}"
export SERVER_IMAGE="${server_image}"

compose=(
  docker compose
  --env-file "${env_file}"
  -f "${compose_file}"
)

services_are_ready() {
  local running_services
  running_services="$("${compose[@]}" ps --services --status running)"

  for service in postgres server web; do
    if ! grep -qx "${service}" <<<"${running_services}"; then
      return 1
    fi
  done

  curl --fail --silent --show-error --max-time 10 "${healthcheck_url}" >/dev/null
}

wait_until_ready() {
  local attempt
  for ((attempt = 1; attempt <= healthcheck_attempts; attempt += 1)); do
    if services_are_ready; then
      return 0
    fi
    sleep "${healthcheck_interval}"
  done
  return 1
}

if [[ "${CREATE_BACKUP_BEFORE_DEPLOY:-true}" == "true" && -x "${repo_dir}/scripts/backup-production.sh" ]]; then
  if "${compose[@]}" ps --services --status running | grep -qx postgres; then
    echo "Creating a pre-deploy backup in ${backup_dir}..."
    BACKUP_DIR="${backup_dir}" "${repo_dir}/scripts/backup-production.sh"
  else
    echo "No running production database found; skipping the pre-deploy backup."
  fi
fi

if [[ "${requested_tag}" != "local" ]]; then
  echo "Pulling application images for ${requested_tag}..."
  "${compose[@]}" pull server web
fi

echo "Deploying ${requested_tag}..."
if "${compose[@]}" up -d --no-build --remove-orphans && wait_until_ready; then
  printf '%s\n' "${requested_tag}" >"${current_tag_file}.tmp"
  mv "${current_tag_file}.tmp" "${current_tag_file}"
  echo "Deployment healthy: ${requested_tag}"
  exit 0
fi

echo "Deployment health check failed for ${requested_tag}." >&2
"${compose[@]}" ps >&2 || true
"${compose[@]}" logs --tail=100 server web >&2 || true

if [[ -z "${previous_tag}" || "${previous_tag}" == "${requested_tag}" ]]; then
  echo "No distinct previously successful image tag is available for rollback." >&2
  exit 1
fi

echo "Rolling application images back to ${previous_tag}..." >&2
export IMAGE_TAG="${previous_tag}"
if [[ "${previous_tag}" != "local" ]]; then
  "${compose[@]}" pull server web
fi
"${compose[@]}" up -d --no-build --remove-orphans

if wait_until_ready; then
  echo "Rollback healthy: ${previous_tag}" >&2
  exit 1
fi

echo "Rollback to ${previous_tag} also failed; manual recovery is required." >&2
"${compose[@]}" ps >&2 || true
"${compose[@]}" logs --tail=100 server web >&2 || true
exit 1
