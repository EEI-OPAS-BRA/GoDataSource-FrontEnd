import { ModuleWithProviders } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import * as fromPages from './pages';
import { AuthGuard } from '../../core/services/guards/auth-guard.service';
import { PERMISSION } from '../../core/models/permission.model';
import { YesNoAllDataResolver } from '../../core/services/resolvers/data/yes-no-all.resolver';
import { CreatedOnResolver } from '../../core/services/resolvers/data/created-on.resolver';
import { OutbreakDataResolver } from '../../core/services/resolvers/data/outbreak.resolver';

const routes: Routes = [
  // WhatsApp messages list
  {
    path: '',
    component: fromPages.WhatsappMessageListComponent,
    canActivate: [AuthGuard],
    data: {
      permissions: [
        PERMISSION.WHATSAPP_MESSAGE_LIST
      ]
    },
    resolve: {
      outbreak: OutbreakDataResolver,
      createdOn: CreatedOnResolver,
      yesNoAll: YesNoAllDataResolver
    }
  }
];

export const routing: ModuleWithProviders<RouterModule> = RouterModule.forChild(routes);
