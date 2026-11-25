import { NgModule } from '@angular/core';

// modules
import { routing } from './system-config.module.routing';
import { SharedModule } from '../../shared/shared.module';

// components
import * as fromPages from './pages';
import { SyncProgressDialogComponent } from './components/sync-progress-dialog/sync-progress-dialog.component';
import { SyncActivityPanelComponent } from './components/sync-activity-panel/sync-activity-panel.component';
import { SyncSectionTitleComponent } from './components/sync-section-title/sync-section-title.component';
import { SyncTabsComponent } from './components/sync-tabs/sync-tabs.component';
import { SyncUpstreamAccessPanelComponent } from './components/sync-upstream-access-panel/sync-upstream-access-panel.component';
import { SyncOutbreakRequestsComponent } from './components/sync-outbreak-requests/sync-outbreak-requests.component';

@NgModule({
  imports: [
    routing,
    SharedModule

  ],
  declarations: [
    ...fromPages.pageComponents,
    SyncProgressDialogComponent,
    SyncActivityPanelComponent,
    SyncSectionTitleComponent,
    SyncTabsComponent,
    SyncUpstreamAccessPanelComponent,
    SyncOutbreakRequestsComponent
  ]
})
export class SystemConfigModule {
}
