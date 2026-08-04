import { parseBuildInfo, type BuildInfo } from '@/shared/build/model/build-info';

let pendingBuildInfoRequest: Promise<BuildInfo> | null = null;

export function fetchDeployedBuildInfo(): Promise<BuildInfo> {
  pendingBuildInfoRequest ??= requestDeployedBuildInfo().finally(() => {
    pendingBuildInfoRequest = null;
  });
  return pendingBuildInfoRequest;
}

async function requestDeployedBuildInfo(): Promise<BuildInfo> {
  const response = await fetch('/version.json', {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load deployed build information: ${response.status}`);
  }

  const buildInfo = parseBuildInfo(await response.json());
  if (!buildInfo) {
    throw new Error('The deployed build information is invalid');
  }

  return buildInfo;
}
