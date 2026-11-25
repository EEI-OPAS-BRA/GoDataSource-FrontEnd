// import each page component
import { UpstreamServersListComponent } from './upstream-servers-list/upstream-servers-list.component';
import { ClientApplicationsListComponent } from './client-applications-list/client-applications-list.component';
import { BackupsComponent } from './backups/backups.component';
import { ViewHistorySystemDeviceComponent } from './view-history-system-device/view-history-system-device.component';
import { SystemSyncLogsComponent } from './system-sync-logs/system-sync-logs.component';
import { UpstreamServersCreateViewModifyComponent } from './upstream-servers-create-view-modify/upstream-servers-create-view-modify.component';
import { ClientApplicationsCreateViewModifyComponent } from './client-applications-create-view-modify/client-applications-create-view-modify.component';
import { SystemDevicesCreateViewModifyComponent } from './system-devices-create-view-modify/system-devices-create-view-modify.component';
import { SystemDevicesComponent } from './system-devices-list/system-devices.component';
import { BackupsRestoresComponent } from './backups-restores/backups-restores.component';
import { NotificationSettingsComponent } from './notification-settings/notification-settings.component';
import { SyncDocumentationComponent } from './sync-documentation/sync-documentation.component';
import { SyncOutbreakMappingEditComponent } from './sync-outbreak-mapping-edit/sync-outbreak-mapping-edit.component';
import { SyncClientComponent } from './sync-client/sync-client.component';
import { SyncUpstreamServerComponent } from './sync-upstream-server/sync-upstream-server.component';

// export each page component individually
export * from './upstream-servers-create-view-modify/upstream-servers-create-view-modify.component';
export * from './upstream-servers-list/upstream-servers-list.component';
export * from './client-applications-create-view-modify/client-applications-create-view-modify.component';
export * from './client-applications-list/client-applications-list.component';
export * from './backups/backups.component';
export * from './backups-restores/backups-restores.component';
export * from './notification-settings/notification-settings.component';
export * from './system-devices-create-view-modify/system-devices-create-view-modify.component';
export * from './system-devices-list/system-devices.component';
export * from './view-history-system-device/view-history-system-device.component';
export * from './system-sync-logs/system-sync-logs.component';
export * from './sync-documentation/sync-documentation.component';
export * from './sync-outbreak-mapping-edit/sync-outbreak-mapping-edit.component';
export * from './sync-client/sync-client.component';
export * from './sync-upstream-server/sync-upstream-server.component';

// export the list of all page components
export const pageComponents: any[] = [
  BackupsComponent,
  BackupsRestoresComponent,
  ClientApplicationsCreateViewModifyComponent,
  ClientApplicationsListComponent,
  NotificationSettingsComponent,
  SystemDevicesCreateViewModifyComponent,
  SystemDevicesComponent,
  SystemSyncLogsComponent,
  SyncDocumentationComponent,
  SyncOutbreakMappingEditComponent,
  SyncClientComponent,
  SyncUpstreamServerComponent,
  UpstreamServersCreateViewModifyComponent,
  UpstreamServersListComponent,
  ViewHistorySystemDeviceComponent
];
