export interface Platform {
  label: string;
  listSelector: string;
  titleSelector: string;
  linkSelector: string;
  renderMode: 'static' | 'browser';
  hint?: string;
}

export const PLATFORMS: Record<string, Platform> = {
  greenhouse: {
    label: 'Greenhouse',
    listSelector: '.opening',
    titleSelector: 'a',
    linkSelector: 'a',
    renderMode: 'static',
    hint: 'Used by Smartly and others. Static fetch works.',
  },
  teamtailor: {
    label: 'Teamtailor',
    listSelector: '[data-animate="fade-up"]',
    titleSelector: 'h2, .jobs-list-item__title',
    linkSelector: 'a',
    renderMode: 'static',
    hint: 'Used by Finnish Design Shop, Virta, Holvi, UpCloud, IQM, Eficode, Vaimo.',
  },
  successfactors: {
    label: 'SAP SuccessFactors',
    listSelector: '.jobResultItem',
    titleSelector: '.resultJobTitle',
    linkSelector: 'a.resultJobTitle',
    renderMode: 'static',
    hint: 'Used by Wärtsilä and Fortum. Static fetch works.',
  },
  workday: {
    label: 'Workday',
    listSelector: 'li[class*="css-"]',
    titleSelector: 'a[data-automation-id="jobTitle"]',
    linkSelector: 'a[data-automation-id="jobTitle"]',
    renderMode: 'browser',
    hint: 'Used by Fiskars. Needs Playwright (JS-rendered).',
  },
  workable: {
    label: 'Workable',
    listSelector: 'li[data-ui="job"]',
    titleSelector: 'h2',
    linkSelector: 'a',
    renderMode: 'browser',
    hint: 'Used by M-files. Needs Playwright (JS-rendered).',
  },
  breezy: {
    label: 'Breezy HR',
    listSelector: 'li.position',
    titleSelector: 'h2',
    linkSelector: 'a',
    renderMode: 'browser',
    hint: 'Used by Tuxera. Needs Playwright (JS-rendered).',
  },
};
