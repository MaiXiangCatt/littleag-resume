export type BuildEnvironment = 'development' | 'production';

export type BuildInfo = {
  environment: BuildEnvironment;
  revision: string;
  version: string;
};

declare const __APP_BUILD_INFO__: unknown;

const localBuildInfo: BuildInfo = {
  environment: 'development',
  revision: 'local',
  version: 'local',
};

const badgeBaseStyle =
  'color: #fff; padding: 3px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700;';
const badgeDarkStyle = `${badgeBaseStyle} background: #352c39;`;
const badgePrimaryStyle = `${badgeBaseStyle} background: #bf301e;`;
const badgePrimarySoftStyle = `${badgeBaseStyle} background: #d85a45;`;

export const currentBuildInfo =
  parseBuildInfo(typeof __APP_BUILD_INFO__ === 'undefined' ? undefined : __APP_BUILD_INFO__) ??
  localBuildInfo;

export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    (candidate.environment !== 'development' && candidate.environment !== 'production') ||
    typeof candidate.revision !== 'string' ||
    candidate.revision.length === 0 ||
    typeof candidate.version !== 'string' ||
    candidate.version.length === 0
  ) {
    return null;
  }

  return {
    environment: candidate.environment,
    revision: candidate.revision,
    version: candidate.version,
  };
}

export function createBuildConsoleBadge(buildInfo: BuildInfo): [string, ...string[]] {
  if (buildInfo.environment === 'development' || buildInfo.revision === 'local') {
    return [
      '%c LittleAgResume %c local %c development ',
      `${badgeDarkStyle} border-radius: 5px 0 0 5px;`,
      badgePrimaryStyle,
      `${badgePrimarySoftStyle} border-radius: 0 5px 5px 0;`,
    ];
  }

  return [
    `%c LittleAgResume %c online %c v${buildInfo.version} %c ${buildInfo.revision.slice(0, 7)} `,
    `${badgeDarkStyle} border-radius: 5px 0 0 5px;`,
    badgePrimaryStyle,
    badgePrimarySoftStyle,
    `${badgeDarkStyle} border-radius: 0 5px 5px 0;`,
  ];
}

export function isDeployedBuild(buildInfo: BuildInfo): boolean {
  return buildInfo.environment === 'production' && buildInfo.revision !== 'local';
}

export function isNewerDeployment(current: BuildInfo, deployed: BuildInfo): boolean {
  return (
    isDeployedBuild(current) && isDeployedBuild(deployed) && deployed.revision !== current.revision
  );
}
