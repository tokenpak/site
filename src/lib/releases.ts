import raw from '../../data/releases.json';

export interface ReleaseEntry {
  version: string;
  published_at: string;
  title: string;
  summary?: string;
  body_markdown?: string;
  changelog_url?: string;
  github_release_url?: string;
  pypi_url?: string;
  latest?: boolean;
  prerelease?: boolean;
}

export const releases: ReleaseEntry[] = raw as ReleaseEntry[];

export function latestRelease(): ReleaseEntry | undefined {
  return releases.find((r) => r.latest === true);
}

export function publishedReleases(): ReleaseEntry[] {
  return releases
    .filter((r) => !r.prerelease)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}
