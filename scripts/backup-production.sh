#!/usr/bin/env bash

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${BACKUP_DIR:-${repo_dir}/backups}"
compose_file="${repo_dir}/deploy/docker-compose.yml"
env_file="${repo_dir}/.env.prod"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

umask 077
mkdir -p "${backup_dir}"
temporary_dir="$(mktemp -d "${backup_dir}/.littleag-backup.XXXXXX")"
trap 'rm -rf -- "${temporary_dir}"' EXIT

compose=(
  docker compose
  --env-file "${env_file}"
  -f "${compose_file}"
)

database_file="${temporary_dir}/postgres-${timestamp}.dump"
avatars_file="${temporary_dir}/avatars-${timestamp}.tar.gz"

"${compose[@]}" exec -T postgres sh -c \
  'exec pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom --compress=6' \
  >"${database_file}"
"${compose[@]}" exec -T server tar -C /data -czf - avatars >"${avatars_file}"

test -s "${database_file}"
test -s "${avatars_file}"

mv "${database_file}" "${backup_dir}/"
mv "${avatars_file}" "${backup_dir}/"
(
  cd "${backup_dir}"
  sha256sum "postgres-${timestamp}.dump" "avatars-${timestamp}.tar.gz" \
    >"checksums-${timestamp}.sha256"
)

echo "Backup completed: ${backup_dir}"
echo "Copy these files to an off-host object store before treating the backup as complete."
