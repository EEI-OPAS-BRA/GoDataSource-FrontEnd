import { IV2InfoBannerAccordion } from '../../shared/components-v2/app-info-banner-v2/models/info-banner.model';

/**
 * Data sent / received when synchronizing with other Go.Data instances
 * Note: must match the collections synchronized by the API (dbSync.syncCollections)
 */
export const SYNCED_DATA_INFO_BANNER_ACCORDION: IV2InfoBannerAccordion = {
  icon: 'dataset',
  title: 'LNG_INFO_BANNER_SYNCED_DATA_TITLE',
  lists: [
    {
      type: 'included',
      title: 'LNG_INFO_BANNER_SYNCED_DATA_INCLUDED_TITLE',
      items: [
        {
          icon: 'bug_report',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_OUTBREAKS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_OUTBREAKS_DESCRIPTION'
        }, {
          icon: 'person',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_PERSONS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_PERSONS_DESCRIPTION'
        }, {
          icon: 'assignment',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_FOLLOW_UPS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_FOLLOW_UPS_DESCRIPTION'
        }, {
          icon: 'science',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_LAB_RESULTS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_LAB_RESULTS_DESCRIPTION'
        }, {
          icon: 'group_work',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_RELATIONSHIPS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_RELATIONSHIPS_DESCRIPTION'
        }, {
          icon: 'account_tree',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_TRANSMISSION_CHAINS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_TRANSMISSION_CHAINS_DESCRIPTION'
        }, {
          icon: 'attach_file',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_FILES',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_FILES_DESCRIPTION'
        }, {
          icon: 'location_on',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_REFERENCE_DATA',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_REFERENCE_DATA_DESCRIPTION'
        }, {
          icon: 'translate',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_LANGUAGES',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_LANGUAGES_DESCRIPTION'
        }, {
          icon: 'supervised_user_circle',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_USERS',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_USERS_DESCRIPTION'
        }, {
          icon: 'description',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_TEMPLATES',
          description: 'LNG_INFO_BANNER_SYNCED_DATA_TEMPLATES_DESCRIPTION'
        }
      ]
    }, {
      type: 'excluded',
      title: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_TITLE',
      items: [
        {
          icon: 'lock',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_ROLES'
        }, {
          icon: 'settings',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_SYSTEM_SETTINGS'
        }, {
          icon: 'phonelink_lock',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_CLIENTS_AND_DEVICES'
        }, {
          icon: 'history',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_AUDIT_LOG'
        }, {
          icon: 'help',
          label: 'LNG_INFO_BANNER_SYNCED_DATA_EXCLUDED_HELP'
        }
      ]
    }
  ],
  notes: [
    'LNG_INFO_BANNER_SYNCED_DATA_NOTE_CHANGES_ONLY',
    'LNG_INFO_BANNER_SYNCED_DATA_NOTE_OUTBREAKS'
  ]
};
