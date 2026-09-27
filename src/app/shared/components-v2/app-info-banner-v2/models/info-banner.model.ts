export interface IV2InfoBannerStep {
  icon: string;
  title: string;
  description: string;
}

/**
 * Accordion item
 */
export interface IV2InfoBannerAccordionItem {
  icon: string;
  label: string;
  description?: string;
}

/**
 * Accordion list - included items are highlighted, excluded ones are muted
 */
export interface IV2InfoBannerAccordionList {
  type: 'included' | 'excluded';
  title: string;
  items: IV2InfoBannerAccordionItem[];
}

/**
 * Accordion - starts collapsed
 */
export interface IV2InfoBannerAccordion {
  icon: string;
  title: string;
  lists: IV2InfoBannerAccordionList[];
  notes?: string[];
}
