import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Polygon, Rect } from 'react-native-svg';
import { colors } from '../theme';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function createIcon(paths: React.ReactNode, viewBox = '0 0 24 24') {
  return ({ size = 24, color = colors.text, strokeWidth = 2 }: IconProps) => (
    <Svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths}
    </Svg>
  );
}

// Lucide-style icons matching web's icons.tsx

export const CloudArrowUpIcon = createIcon(
  <>
    <Path d="M12 16v-8m0 0-3 3m3-3 3 3" />
    <Path d="M20 16.7A4 4 0 0 0 18 9h-1.26A8 8 0 1 0 4 16.7" />
  </>
);

export const EnvelopeIcon = createIcon(
  <>
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
);

export const LockIcon = createIcon(
  <>
    <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);

export const UserIcon = createIcon(
  <>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </>
);

export const ArrowRightIcon = createIcon(
  <>
    <Path d="M5 12h14m-7-7 7 7-7 7" />
  </>
);

export const EyeIcon = createIcon(
  <>
    <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <Circle cx="12" cy="12" r="3" />
  </>
);

export const EyeSlashIcon = createIcon(
  <>
    <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <Line x1="2" y1="2" x2="22" y2="22" />
  </>
);

export const CheckCircleIcon = createIcon(
  <>
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="m9 11 3 3L22 4" />
  </>
);

export const FolderIcon = createIcon(
  <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
);

export const FolderOpenIcon = createIcon(
  <Path d="M6 14l1.5-2.5A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.8 2.9l-2.4 4A2 2 0 0 1 17.4 18H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2" />
);

export const GearIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  </>
);

export const PlusIcon = createIcon(
  <Path d="M12 5v14m-7-7h14" />
);

export const HomeIcon = createIcon(
  <>
    <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </>
);

export const TrashIcon = createIcon(
  <>
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </>
);

export const MagnifyingGlassIcon = createIcon(
  <>
    <Circle cx="11" cy="11" r="8" />
    <Path d="m21 21-4.3-4.3" />
  </>
);

export const CloudArrowUpFilledIcon = createIcon(
  <>
    <Path d="M12 16v-8m0 0-3 3m3-3 3 3" />
    <Path d="M20 16.7A4 4 0 0 0 18 9h-1.26A8 8 0 1 0 4 16.7" />
  </>,
  '0 0 24 24'
);

export const PhotosIcon = createIcon(
  <>
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Circle cx="8.5" cy="8.5" r="1.5" />
    <Polyline points="21 15 16 10 5 21" />
  </>
);

export const AlbumsIcon = createIcon(
  <>
    <Rect x="2" y="3" width="20" height="17" rx="2" ry="2" />
    <Path d="M2 8h20" />
    <Path d="M6 12h4" />
    <Path d="M8 12v4" />
    <Rect x="16" y="12" width="4" height="4" rx="1" />
  </>
);

export const ShieldCheckIcon = createIcon(
  <>
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <Path d="m9 12 2 2 4-4" />
  </>
);

export const PlayIcon = createIcon(
  <Polygon points="5 3 19 12 5 21 5 3" />
);

export const PauseIcon = createIcon(
  <>
    <Rect x="6" y="4" width="4" height="16" rx="1" />
    <Rect x="14" y="4" width="4" height="16" rx="1" />
  </>
);

export const ChevronRightIcon = createIcon(
  <Path d="m9 18 6-6-6-6" />
);

export const ArrowLeftIcon = createIcon(
  <Path d="m15 18-6-6 6-6" />
);

export const EllipsisVerticalIcon = createIcon(
  <>
    <Circle cx="12" cy="5" r="1" />
    <Circle cx="12" cy="12" r="1" />
    <Circle cx="12" cy="19" r="1" />
  </>
);

export const GlobeIcon = createIcon(
  <>
    <Circle cx="12" cy="12" r="10" />
    <Line x1="2" y1="12" x2="22" y2="12" />
    <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>
);

export const XMarkIcon = createIcon(
  <Path d="M18 6 6 18M6 6l12 12" />
);

export const ArrowPathIcon = createIcon(
  <>
    <Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
    <Path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <Path d="M16 16h5v5" />
  </>
);

export default {
  CloudArrowUpIcon, EnvelopeIcon, LockIcon, UserIcon, ArrowRightIcon,
  EyeIcon, EyeSlashIcon, CheckCircleIcon, FolderIcon, FolderOpenIcon,
  GearIcon, PlusIcon, HomeIcon, TrashIcon, MagnifyingGlassIcon,
  PhotosIcon, PlayIcon, PauseIcon, ChevronRightIcon, EllipsisVerticalIcon,
  XMarkIcon, ArrowPathIcon, CloudArrowUpFilledIcon, GlobeIcon, AlbumsIcon,
  ArrowLeftIcon,
};
