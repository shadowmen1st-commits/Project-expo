import React from 'react';

interface LocationGateProps {
  children: React.ReactNode;
}

export const LocationGate: React.FC<LocationGateProps> = ({ children }) => {
  return <>{children}</>;
};

export default LocationGate;
