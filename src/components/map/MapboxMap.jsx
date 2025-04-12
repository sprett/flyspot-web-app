import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Upload from './Upload';
import Map from 'react-map-gl/mapbox';
import kml from 'togeojson'; // Import the togeojson library
import { fetchParaglidingSpots } from '../../data/paraglidingSpots/ParaglidingspotAPI';

const MapboxMap = () => {
  // Reference to the map container
  const mapContainerRef = useRef(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Declare state to track file upload and errors
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [spotsGeoJSON, setSpotsGeoJSON] = useState(null);

  useEffect(() => {
    // Set your Mapbox access token here
    mapboxgl.accessToken = 'pk.eyJ1IjoiZGlub2giLCJhIjoiY204NXFtdXVvMTl2OTJrcjRveXY5djBxayJ9.DJbLLOam3jot6W1wQc4MBQ';

    // Clean up on unmount
    return () => {
      window.map = null;
    };
  }, []);

  useEffect(() => {
    if (window.map && window.deckFlightPathData) {
      
      const segments = window.deckFlightPathData.map((pathData) => {
        return pathData.path.map((coord, i) => {
          if (i < pathData.path.length - 1) {
            const [lon1, lat1, alt1] = coord;
            const [lon2, lat2, alt2] = pathData.path[i + 1];
            return {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [lon1, lat1],
                    [lon2, lat2],
                    [lon2, lat2],
                    [lon1, lat1]
                  ]
                ]
              },
              properties: {
                altitude: alt2
              }
            };
          }
          return null;
        }).filter(Boolean);
      }).flat();

      setIsFileLoaded(true);
    }
  }, [window.deckFlightPathData, isFileLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Map
        mapboxAccessToken={mapboxgl.accessToken}
        mapStyle="mapbox://styles/mapbox/standard-satellite"
        projection={{ name: 'globe' }}
        initialViewState={{
          longitude: 10,
          latitude: 50,
          zoom: 3,
          pitch: 0,
          bearing: 0
        }}
        maxPitch={60}
      
        terrain={{ source: 'mapbox-dem' }}
        onLoad={(e) => {
          const map = e.target;
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.terrain-rgb',
            tileSize: 512,
            maxzoom: 14
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15
            }
          });

          map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
          window.map = map;

          
   
        }}
      />
      <button
        onClick={() => setUploadOpen(true)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '10px 15px',
          zIndex: 1
        }}
        className="bg-cyan-500 text-white rounded shadow-md"
      >
        Upload
      </button>
      {uploadOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setUploadOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Upload onUploadComplete={() => setUploadOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MapboxMap;