import React from 'react';

function FlightStats({ stats }) {
  if (!stats) return null;
  
  return (
    <div className="mt-4 bg-slate-800 p-4 rounded text-white">
      <h4 className="mb-2 font-semibold">Flight Statistics</h4>
      <p>Highest Altitude: {stats.highestAltitude} m</p>
      <p>Total Distance: {stats.totalKm} km</p>
      <p>Total Time: {stats.totalTime}</p>
    </div>
  );
}

export default FlightStats;