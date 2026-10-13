import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SystemStateView } from '../components/ui/SystemStateView';
import stateSpotNoRequiredCourses from '../assets/icons/state-spot-no-required-courses.svg';

export const NoRequiredCoursesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/');
    } else {
      navigate(-1);
    }
  };

  return (
    <SystemStateView
      art={stateSpotNoRequiredCourses}
      title="No courses yet"
      message="Courses for the city you drive in will appear here."
      onBack={handleBack}
    />
  );
};
