import raw from '../../data/docs-links.json';

export interface DocLinkEntry {
  title: string;
  url: string;
  section: 'starter' | 'reference' | 'support' | 'protocol';
  description: string;
  updated_at?: string;
  source_hint?: string;
}

export const docsLinks: DocLinkEntry[] = raw as DocLinkEntry[];

export function linksBySection(section: DocLinkEntry['section']): DocLinkEntry[] {
  return docsLinks.filter((l) => l.section === section);
}
