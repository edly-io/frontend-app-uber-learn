import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemStateView } from '../components/ui/SystemStateView';
import stateSpotNoRequiredCourses from '../assets/icons/state-spot-no-required-courses.svg';

export const CourseNotAvailablePage = () => {
  const navigate = useNavigate();

  return (
    <SystemStateView
      art={stateSpotNoRequiredCourses}
      title="This course isn't available"
      message="It may have been replaced or removed. Your points and badges are safe."
      buttonLabel="Go to Learning home"
      onAction={() => navigate('/')}
      onBack={() => navigate('/')}
    />
  );
};
