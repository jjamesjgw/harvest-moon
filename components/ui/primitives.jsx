// Re-export shim. The primitives were split into atoms / layout / overlays
// for editability (the original file had grown to 858 lines, 22 exports
// mixing atoms with chrome with banners). All existing import sites
// continue to work via `import { X } from '@/components/ui/primitives'`.
//
// When writing new code, prefer importing directly from the source file
// (atoms / layout / overlays) — clearer dependencies, smaller surface.
export {
  Chip,
  CarNum,
  PlayerBadge,
  SectionLabel,
  LinkArrow,
  BackChip,
  Icon,
  DriverRow,
  MenuRow,
  Field,
  LabeledInput,
  WinsCount,
} from './atoms';

export {
  TopBar,
  TabBar,
  AppFrame,
  PullToRefresh,
} from './layout';

export {
  AllStarDraftPaused,
  JustPickedToast,
  YourTurnToast,
  RaceCountdown,
  OnTheClockBanner,
  SaveBanner,
} from './overlays';
