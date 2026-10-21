import React from 'react';
import { SystemStateView } from '../components/ui/SystemStateView';
import stateSpotNoRequiredCourses from '../assets/icons/state-spot-no-required-courses.svg';

export const NoRequiredCoursesPage = () => (
  <SystemStateView
    art={stateSpotNoRequiredCourses}
    title="No courses yet"
    message="Courses for the city you drive in will appear here."
  />
);
