import { OutbreakModel } from '../../../models/outbreak.model';
import { IV2ColumnToVisibleMandatoryConf, V2AdvancedFilterToVisibleMandatoryConf } from '../../../../shared/forms-v2/components/app-form-visible-mandatory-v2/models/visible-mandatory.model';
import { V2AdvancedFilter } from '../../../../shared/components-v2/app-list-table-v2/models/advanced-filter.model';
import { IV2Column, V2ColumnFormat } from '../../../../shared/components-v2/app-list-table-v2/models/column.model';
import { ILabelValuePairModel } from '../../../../shared/forms-v2/core/label-value-pair.model';
import { AddressModel, AddressType } from '../../../models/address.model';
import { LocationModel } from '../../../models/location.model';
import { UserModel } from '../../../models/user.model';

export class ListHelperModel {
  /**
   * Check if a column should be visible depending on outbreak visible/mandatory settings
   */
  shouldVisibleMandatoryTableColumnBeVisible(
    outbreak: OutbreakModel,
    visibleMandatoryKey: string,
    prop: string
  ): boolean {
    // no custom settings found ?
    if (
      !outbreak ||
      !outbreak.visibleAndMandatoryFields ||
      !outbreak.visibleAndMandatoryFields[visibleMandatoryKey] ||
      outbreak.visibleAndMandatoryFields[visibleMandatoryKey][prop]?.visible ||
      Object.keys(outbreak.visibleAndMandatoryFields[visibleMandatoryKey]).length < 1
    ) {
      return true;
    }

    // matched
    return false;
  }

  /**
   * Filter advanced filters depending on outbreak visible/mandatory settings
   */
  filterVisibleMandatoryAdvancedFilters(advancedFilters: V2AdvancedFilterToVisibleMandatoryConf[]): V2AdvancedFilter[] {
    return (advancedFilters || []).filter((filter) => {
      return filter.visibleMandatoryIf();
    });
  }

  /**
   * Filter table columns depending on outbreak visible/mandatory settings
   */
  filterVisibleMandatoryTableColumns<T extends (IV2Column | IV2ColumnToVisibleMandatoryConf)>(items: IV2ColumnToVisibleMandatoryConf[]): T[] {
    return (items || []).filter((column) => column.visibleMandatoryIf ?
      column.visibleMandatoryIf() :
      true
    ) as T[];
  }

  /**
   * Build one location column per address type (except the current / usual place of residence,
   * which already has its own dedicated column). Each column lists the location(s) of the
   * addresses that match its type, linking to the location view when the user can view it.
   */
  retrieveAddressLocationColumnsPerType(
    addressTypeOptions: ILabelValuePairModel[],
    authUser: UserModel,
    addressesGetter: (item: any) => AddressModel[] = (item) => item?.addresses
  ): IV2ColumnToVisibleMandatoryConf[] {
    return (addressTypeOptions || [])
      // the current address already has a dedicated (filterable) location column
      .filter((option) => option.value !== AddressType.CURRENT_ADDRESS)
      .map((option): IV2ColumnToVisibleMandatoryConf => ({
        field: `addressLocation_${option.value}`,
        label: option.label,
        visibleMandatoryIf: () => true,
        format: {
          type: V2ColumnFormat.LINK_LIST
        },
        links: (item: any) => (addressesGetter(item) || [])
          .filter((address) => address.typeId === option.value && address.location?.name)
          .map((address) => ({
            label: address.location.name,
            href: LocationModel.canView(authUser) ?
              `/locations/${address.location.id}/view` :
              undefined
          }))
      }));
  }
}
