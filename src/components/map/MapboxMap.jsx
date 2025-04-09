import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const Map = () => {
  // Reference to the map container
  const mapContainerRef = useRef(null);

  useEffect(() => {
    // Set your Mapbox access token here
    mapboxgl.accessToken = 'pk.eyJ1IjoiZGlub2giLCJhIjoiY204NXFtdXVvMTl2OTJrcjRveXY5djBxayJ9.DJbLLOam3jot6W1wQc4MBQ';

    // Initialize the map instance with satellite imagery style
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,           // Reference to the container element
      style: 'mapbox://styles/mapbox/standard-satellite', 
      projection: 'globe', // Updated to use satellite imagery
      center: [-74.5, 40],                           // Starting position [lng, lat]
      zoom: 9                                        // Starting zoom level
    });

    // Once the map loads, add DEM source and enable 3D terrain
    map.on('load', () => {
      // Add the DEM source for terrain data
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb',
        tileSize: 512,
        maxzoom: 14
      });

      // Enable 3D terrain with an exaggeration
      map.setTerrain({source: 'mapbox-dem', exaggeration: 1.5});

      // Optional: Add a sky layer for a more immersive 3D effect
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });
    });

    // Optional: Add navigation controls (zoom and rotation)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Clean up on unmount
    return () => map.remove();
  }, []);

  return (
    // The container where the map will be rendered
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '100vh' }}
    />
  );
};

export default Map;