import { describe, expect, it } from 'vitest';

import {
  createBuildConsoleBadge,
  isNewerDeployment,
  parseBuildInfo,
  type BuildInfo,
} from './build-info';

const productionBuild: BuildInfo = {
  environment: 'production',
  revision: 'b6fb3bacbfa1d1b209232626b88378b3e34a5537',
  version: '0.2.2',
};

describe('build info model', () => {
  it('parses complete build information and rejects incomplete values', () => {
    expect(parseBuildInfo(productionBuild)).toEqual(productionBuild);
    expect(parseBuildInfo({ revision: productionBuild.revision, version: '0.2.2' })).toBeNull();
    expect(parseBuildInfo({ ...productionBuild, revision: '' })).toBeNull();
  });

  it('formats local and deployed labels for the developer console', () => {
    const localBadge = createBuildConsoleBadge({
      environment: 'development',
      revision: 'local',
      version: '0.2.2',
    });
    const productionBadge = createBuildConsoleBadge(productionBuild);

    expect(localBadge[0]).toBe('%c LittleAgResume %c local %c development ');
    expect(productionBadge[0]).toBe('%c LittleAgResume %c online %c v0.2.2 %c b6fb3ba ');
    expect(
      productionBadge
        .slice(1)
        .every((style) => ['#352c39', '#bf301e', '#d85a45'].some((color) => style.includes(color))),
    ).toBe(true);
  });

  it('detects deployments by revision instead of the product version', () => {
    expect(
      isNewerDeployment(productionBuild, {
        ...productionBuild,
        revision: 'c7ac4bacbfa1d1b209232626b88378b3e34a9999',
      }),
    ).toBe(true);
    expect(isNewerDeployment(productionBuild, productionBuild)).toBe(false);
    expect(
      isNewerDeployment(
        {
          environment: 'development',
          revision: 'local',
          version: '0.2.2',
        },
        productionBuild,
      ),
    ).toBe(false);
  });
});
