/**
 * The AURUM primitive library.
 *
 * Everything here reads the token layer through semantic roles only — no hex,
 * no ramp value, no invented custom property. A finish change recalculates
 * nothing in this folder.
 */

export { Button, Spinner } from "./button";
export type {
  ButtonProps,
  ButtonOwnProps,
  ButtonSize,
  ButtonVariant,
} from "./button";

export { Card, CardHeader, CardTitle, CardBody, CardFooter } from "./card";
export type {
  CardAccent,
  CardProps,
  CardHeaderProps,
  CardTitleProps,
} from "./card";

export { KpiCard, InfoTip } from "./kpi-card";
export type { KpiCardProps, InfoTipProps } from "./kpi-card";

export { Pill } from "./pill";
export type { PillProps, PillTone } from "./pill";

export { Avatar, AvatarGroup } from "./avatar";
export type { AvatarProps, AvatarGroupProps, AvatarSize } from "./avatar";

export { StarRating, StarRatingInput } from "./star-rating";
export type { StarRatingProps, StarRatingInputProps } from "./star-rating";

export { DataTable } from "./table";
export type {
  Column,
  DataTableProps,
  SortDirection,
  SortState,
} from "./table";

export { Field, TextInput, TextArea, Select, SearchInput } from "./field";
export type {
  FieldProps,
  TextInputProps,
  TextAreaProps,
  SelectProps,
  SelectOption,
  SearchInputProps,
} from "./field";

export { Switch, Checkbox } from "./toggle";
export type { SwitchProps, CheckboxProps } from "./toggle";

export { Segmented } from "./segmented";
export type { SegmentedProps, SegmentedOption } from "./segmented";

export { Tabs, TabList, Tab, TabPanel } from "./tabs";
export type { TabsProps, TabListProps, TabProps, TabPanelProps } from "./tabs";

export { Sheet, Alert } from "./modal";
export type { SheetProps, AlertProps, AlertAction } from "./modal";

export { ToastProvider, useToast } from "./toast";
export type { ToastOptions, ToastAction, ToastTone } from "./toast";

export { Skeleton, SkeletonText } from "./skeleton";
export type { SkeletonProps, SkeletonTextProps } from "./skeleton";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

export { DarkModeToggle, FinishPicker } from "./theme-switcher";
export type { DarkModeToggleProps, FinishPickerProps } from "./theme-switcher";
