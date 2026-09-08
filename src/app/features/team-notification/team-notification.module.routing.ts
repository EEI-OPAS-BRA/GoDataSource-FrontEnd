import { ModuleWithProviders } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import * as fromPages from './pages';
import { AuthGuard } from '../../core/services/guards/auth-guard.service';
import { PERMISSION } from '../../core/models/permission.model';
import { TeamDataResolver } from '../../core/services/resolvers/data/team.resolver';
import { YesNoAllDataResolver } from '../../core/services/resolvers/data/yes-no-all.resolver';
import { CreatedOnResolver } from '../../core/services/resolvers/data/created-on.resolver';

const routes: Routes = [
  // Team Notifications list
  {
    path: '',
    component: fromPages.TeamNotificationListComponent,
    canActivate: [AuthGuard],
    data: {
      permissions: [
        PERMISSION.TEAM_NOTIFICATION_LIST
      ]
    },
    resolve: {
      team: TeamDataResolver,
      createdOn: CreatedOnResolver,
      yesNoAll: YesNoAllDataResolver
    }
  }
];

export const routing: ModuleWithProviders<RouterModule> = RouterModule.forChild(routes);
