import type { BuilderReturn } from '$lib/internal/types.js';
import type { _Menu } from '../menu/index.js';
import type { createContextMenu } from './create.js';
export type { ContextMenuComponentEvents } from './events.js';

// Props
/**
 * @category ContextMenu
 * @category Props
 * @interface
 */
export type CreateContextMenuProps = _Menu['builder'];
/**
 * @category ContextMenu
 * @category Props
 * @interface
 */
export type CreateContextSubmenuProps = _Menu['submenu'];
/**
 * @category ContextMenu
 */
export type ContextMenuItemProps = _Menu['item'];
/**
 * @category ContextMenu
 * @category Props
 * @interface
 */
export type CreateContextMenuRadioGroupProps = _Menu['radioGroup'];
/**
 * @category ContextMenu
 * @category Props
 * @interface
 */
export type CreateContextMenuCheckboxItemProps = _Menu['checkboxItem'];
/**
 * @category ContextMenu
 */
export type ContextMenuRadioItemProps = _Menu['radioItem'];
/**
 * @category ContextMenu
 */
export type ContextMenuRadioItemActionProps = _Menu['radioItemAction'];

// Returns
export type ContextMenu = BuilderReturn<typeof createContextMenu>;
export type ContextMenuElements = ContextMenu['elements'];
export type ContextMenuOptions = ContextMenu['options'];
export type ContextMenuStates = ContextMenu['states'];
export type ContextMenuBuilders = ContextMenu['builders'];

export type ContextMenuSubmenu = BuilderReturn<ContextMenuBuilders['createSubmenu']>;
export type ContextMenuSubmenuElements = ContextMenuSubmenu['elements'];
export type ContextMenuSubmenuOptions = ContextMenuSubmenu['options'];
export type ContextMenuSubmenuStates = ContextMenuSubmenu['states'];

export type ContextMenuRadioGroup = BuilderReturn<ContextMenuBuilders['createMenuRadioGroup']>;
export type ContextMenuRadioGroupElements = ContextMenuRadioGroup['elements'];
export type ContextMenuRadioGroupStates = ContextMenuRadioGroup['states'];
export type ContextMenuRadioGroupHelpers = ContextMenuRadioGroup['helpers'];
