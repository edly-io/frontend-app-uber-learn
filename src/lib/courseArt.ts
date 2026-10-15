import courseArtBlue from '../assets/icons/course-art-blue.svg';
import courseArtTeal from '../assets/icons/course-art-teal.svg';
import courseArtLime from '../assets/icons/course-art-lime.svg';
import courseArtPurple from '../assets/icons/course-art-purple.svg';
import courseArtMagenta from '../assets/icons/course-art-magenta.svg';
import courseArtTeenRides from '../assets/icons/course-art-teen-rides.svg';
import courseArtOrange from '../assets/icons/course-art-orange.svg';

export type CourseTint = 'blue' | 'teal' | 'lime' | 'purple' | 'magenta' | 'teen-rides' | 'orange';

const TINTS: CourseTint[] = ['blue', 'teal', 'lime', 'purple', 'magenta', 'teen-rides', 'orange'];

const ART_SRCS: Record<CourseTint, string> = {
  blue: courseArtBlue,
  teal: courseArtTeal,
  lime: courseArtLime,
  purple: courseArtPurple,
  magenta: courseArtMagenta,
  'teen-rides': courseArtTeenRides,
  orange: courseArtOrange,
};

function hashCourseId(courseId: string): number {
  let h = 0;
  for (let i = 0; i < courseId.length; i++) {
    // eslint-disable-next-line no-bitwise
    h = ((h * 31) + courseId.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Returns a deterministic art SVG src and tint name for a given courseId.
 * The same courseId always maps to the same tint, regardless of which page it appears on.
 */
export function getCourseArt(courseId: string): { artSrc: string; tint: CourseTint } {
  const tint = TINTS[hashCourseId(courseId) % TINTS.length];
  return { artSrc: ART_SRCS[tint], tint };
}
