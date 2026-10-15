import { NgModule } from '@angular/core';

// modules
import { routing } from './system-config.module.routing';
import { SharedModule } from '../../shared/shared.module';

// components
import * as fromPages from './pages';
import { SyncProgressDialogComponent } from './components/sync-progress-dialog/sync-progress-dialog.component';

@NgModule({
  imports: [
    routing,
    SharedModule

  ],
  declarations: [
    ...fromPages.pageComponents,
    SyncProgressDialogComponent
  ]
})
export class SystemConfigModule {
}
