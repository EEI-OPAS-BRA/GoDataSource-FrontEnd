import { IV2InfoBannerAccordion, IV2InfoBannerStep } from '../../shared/components-v2/app-info-banner-v2/models/info-banner.model';
import { SYNCED_DATA_INFO_BANNER_ACCORDION } from './synced-data-info-banner';

/**
 * Sync pages are grouped in two areas, each one with its own tabs:
 * - receive: this instance receives data from other instances / the mobile app
 * - send: this instance sends its data to other instances
 */
export type SyncArea = 'receive' | 'send';

/**
 * Tab of an area
 */
export interface ISyncAreaTab {
  key: 'keys' | 'review' | 'servers' | 'history' | 'how-it-works';
  icon: string;
  label: string;
  link: string[];
}

/**
 * Area
 */
export interface ISyncAreaConfig {
  // page title & where the area starts
  title: string;
  link: string[];

  // direction of the syncs of the area
  direction: 'received' | 'sent';

  tabs: ISyncAreaTab[];

  // how it works
  howItWorks: {
    icon: string,
    heading: string,
    description: string,
    steps: IV2InfoBannerStep[],
    notes: string[],
    accordions: IV2InfoBannerAccordion[]
  };
}

/**
 * Areas
 */
export const SYNC_AREAS: {
  [area in SyncArea]: ISyncAreaConfig
} = {
  receive: {
    title: 'LNG_LAYOUT_MENU_ITEM_CLIENT_APPLICATIONS_LABEL',
    link: ['/system-config/client-applications'],
    direction: 'received',
    tabs: [
      {
        key: 'keys',
        icon: 'vpn_key',
        label: 'LNG_SYNC_AREA_TAB_KEYS',
        link: ['/system-config/client-applications']
      }, {
        key: 'review',
        icon: 'fact_check',
        label: 'LNG_SYNC_AREA_TAB_REVIEW',
        link: ['/system-config/sync-outbreak-mappings']
      }, {
        key: 'history',
        icon: 'history',
        label: 'LNG_SYNC_AREA_TAB_HISTORY',
        link: ['/system-config/client-applications/history']
      }, {
        key: 'how-it-works',
        icon: 'help_outline',
        label: 'LNG_SYNC_AREA_TAB_HOW_IT_WORKS',
        link: ['/system-config/client-applications/how-it-works']
      }
    ],
    howItWorks: {
      icon: 'vpn_key',
      heading: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_DESCRIPTION',
      steps: [
        {
          icon: 'add_circle_outline',
          title: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_1_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_1_DESCRIPTION'
        }, {
          icon: 'tune',
          title: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_2_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_2_DESCRIPTION'
        }, {
          icon: 'share',
          title: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_3_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_3_DESCRIPTION'
        }, {
          icon: 'security',
          title: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_4_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_STEP_4_DESCRIPTION'
        }
      ],
      notes: [
        'LNG_PAGE_LIST_SYSTEM_CLIENT_APPLICATIONS_INFO_NOTE_1'
      ],
      accordions: [
        SYNCED_DATA_INFO_BANNER_ACCORDION
      ]
    }
  },
  send: {
    title: 'LNG_LAYOUT_MENU_ITEM_UPSTREAM_SERVERS_LABEL',
    link: ['/system-config/upstream-servers'],
    direction: 'sent',
    tabs: [
      {
        key: 'servers',
        icon: 'dns',
        label: 'LNG_SYNC_AREA_TAB_SERVERS',
        link: ['/system-config/upstream-servers']
      }, {
        key: 'history',
        icon: 'history',
        label: 'LNG_SYNC_AREA_TAB_HISTORY',
        link: ['/system-config/upstream-servers/history']
      }, {
        key: 'how-it-works',
        icon: 'help_outline',
        label: 'LNG_SYNC_AREA_TAB_HOW_IT_WORKS',
        link: ['/system-config/upstream-servers/how-it-works']
      }
    ],
    howItWorks: {
      icon: 'sync',
      heading: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_TITLE',
      description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_DESCRIPTION',
      steps: [
        {
          icon: 'dns',
          title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_1_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_1_DESCRIPTION'
        }, {
          icon: 'schedule',
          title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_2_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_2_DESCRIPTION'
        }, {
          icon: 'cloud_upload',
          title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_3_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_3_DESCRIPTION'
        }, {
          icon: 'assignment_turned_in',
          title: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_4_TITLE',
          description: 'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_STEP_4_DESCRIPTION'
        }
      ],
      notes: [
        'LNG_PAGE_LIST_SYSTEM_UPSTREAM_SERVERS_INFO_NOTE_1'
      ],
      accordions: [
        SYNCED_DATA_INFO_BANNER_ACCORDION
      ]
    }
  }
};
