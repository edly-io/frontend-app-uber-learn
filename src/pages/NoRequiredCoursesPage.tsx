import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemStateView } from '../components/ui/SystemStateView';
import stateSpotNoRequiredCourses from '../assets/icons/state-spot-no-required-courses.svg';

export const NoRequiredCoursesPage = () => {
  const navigate = useNavigate();
  const handleBack = () => navigate(-1);
  const handleSeeAll = () => navigate('/');

  return (
    <SystemStateView
      art={stateSpotNoRequiredCourses}
      title="No required courses yet"
      message="They'll appear here when Uber assigns them. Optional courses are open any time."
      buttonLabel="See all courses"
      onAction={handleSeeAll}
      onBack={handleBack}
    />
  );
};
