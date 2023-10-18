import type { BuilderReturn } from '$lib/internal/types.js';
import type { _Menu } from '../menu/index.js';
import type { createMenubar } from './create.js';
export type { MenubarComponentEvents } from './events.js';
// Props
/**
 * @category Menubar
 * @category Props
 * @interface
 */
export type CreateMenubarProps = {
	/**
	 * Whether or not the menubar should loop when
	 * navigating with the arrow keys.
	 *
	 * @default true
	 */
	loop?: boolean;

	/**
	 * Whether to close the active menu when the escape key is pressed.
	 */
	closeOnEscape?: boolean;
};
/**
 * @category Menubar
 * @category Props
 * @interface
 */
export type CreateMenubarMenuProps = _Menu['builder'];
/**
 * @category Menubar
 * @category Props
 * @interface
 */
export type CreateMenubarSubmenuProps = _Menu['submenu'];
/**
 * @category Menubar
 */
export type MenubarMenuItemProps = _Menu['item'];
/**
 * @category Menubar
 * @category Props
 * @interface
 */
export type CreateMenuRadioGroupProps = _Menu['radioGroup'];
/**
 * @category Menubar
 * @category Props
 * @interface
 */
export type CreateMenuCheckboxItemProps = _Menu['checkboxItem'];
/**
 * @category Menubar
 */
export type MenubarRadioItemProps = _Menu['radioItem'];
/**
 * @category Menubar
 */
export type MenubarRadioItemActionProps = _Menu['radioItemAction'];

// Returns
export type Menubar = BuilderReturn<typeof createMenubar>;
export type MenubarElements = Menubar['elements'];
export type MenubarOptions = Menubar['options'];
export type MenubarBuilders = Menubar['builders'];

export type MenubarMenu = BuilderReturn<MenubarBuilders['createMenu']>;
export type MenubarMenuElements = MenubarMenu['elements'];
export type MenubarMenuOptions = MenubarMenu['options'];
export type MenubarMenuStates = MenubarMenu['states'];
export type MenubarMenuBuilders = MenubarMenu['builders'];

export type MenubarMenuSubmenu = BuilderReturn<MenubarMenuBuilders['createSubmenu']>;
export type MenubarMenuSubmenuElements = MenubarMenuSubmenu['elements'];
export type MenubarMenuSubmenuOptions = MenubarMenuSubmenu['options'];
export type MenubarMenuSubmenuStates = MenubarMenuSubmenu['states'];

export type MenubarMenuRadioGroup = BuilderReturn<MenubarMenuBuilders['createMenuRadioGroup']>;
export type MenubarMenuRadioGroupElements = MenubarMenuRadioGroup['elements'];
export type MenubarMenuRadioGroupStates = MenubarMenuRadioGroup['states'];
export type MenubarMenuRadioGroupHelpers = MenubarMenuRadioGroup['helpers'];
