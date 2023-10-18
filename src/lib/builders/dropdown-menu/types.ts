import type { BuilderReturn } from '$lib/internal/types.js';
import type { _Menu } from '../menu/index.js';
import type { createDropdownMenu } from './create.js';
export type { DropdownMenuComponentEvents } from './events.js';
// Props
/**
 * @category DropdownMenu
 * @category Props
 * @interface
 */
export type CreateDropdownMenuProps = _Menu['builder'];
/**
 * @category DropdownMenu
 * @category Props
 * @interface
 */
export type CreateDropdownSubmenuProps = _Menu['submenu'];
/**
 * @category DropdownMenu
 */
export type DropdownMenuItemProps = _Menu['item'];
/**
 * @category DropdownMenu
 * @category Props
 * @interface
 */
export type CreateDropdownMenuRadioGroupProps = _Menu['radioGroup'];
/**
 * @category DropdownMenu
 * @category Props
 * @interface
 */
export type CreateDropdownMenuCheckboxItemProps = _Menu['checkboxItem'];
/**
 * @category DropdownMenu
 */
export type DropdownMenuRadioItemProps = _Menu['radioItem'];
/**
 * @category DropdownMenu
 */
export type DropdownMenuRadioItemActionProps = _Menu['radioItemAction'];

// Returns
export type DropdownMenu = BuilderReturn<typeof createDropdownMenu>;
export type DropdownMenuElements = DropdownMenu['elements'];
export type DropdownMenuOptions = DropdownMenu['options'];
export type DropdownMenuStates = DropdownMenu['states'];
export type DropdownMenuBuilders = DropdownMenu['builders'];

export type DropdownMenuSubmenu = BuilderReturn<DropdownMenuBuilders['createSubmenu']>;
export type DropdownMenuSubmenuElements = DropdownMenuSubmenu['elements'];
export type DropdownMenuSubmenuOptions = DropdownMenuSubmenu['options'];
export type DropdownMenuSubmenuStates = DropdownMenuSubmenu['states'];

export type DropdownMenuRadioGroup = BuilderReturn<DropdownMenuBuilders['createMenuRadioGroup']>;
export type DropdownMenuRadioGroupElements = DropdownMenuRadioGroup['elements'];
export type DropdownMenuRadioGroupStates = DropdownMenuRadioGroup['states'];
export type DropdownMenuRadioGroupHelpers = DropdownMenuRadioGroup['helpers'];
