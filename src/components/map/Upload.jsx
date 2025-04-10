import React, { useState } from 'react';
import { kml } from '@tmcw/togeojson';
import mapboxgl from 'mapbox-gl';

function Upload({ onUploadComplete }) {
  // State for upload progress and file information
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState(null);

  // Handle file selection and simulate upload progress
  const handleFileChange = (e) => {
    e.preventDefault();
    let file;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      file = e.dataTransfer.files[0];
    } else {
      file = e.target.files[0];
    }
    if (!file) return;

    // Check if the file is a KML file (by extension)
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.kml')) {
      setError("File not supported");
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const kmlText = event.target.result;
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlText, 'text/xml');
      const geojson = kml(kmlDom);

      const map = window.map;
      if (!map) {
        console.error("Map is not initialized");
        return;
      }

      if (map.getLayer('kml-layer')) {
        map.removeLayer('kml-layer');
      }
      if (map.getSource('kml-source')) {
        map.removeSource('kml-source');
      }

      if (map.getLayer('altitude-gradient-line')) {
        map.removeLayer('altitude-gradient-line');
      }
      if (map.getSource('path-extrusions')) {
        map.removeSource('path-extrusions');
      }
      if (map.getLayer('path-extrusions')) {
        map.removeLayer('path-extrusions');
      }

      geojson.features.forEach((feature) => {
        if (!feature.geometry || feature.geometry.type !== 'LineString') return;

        const coords = feature.geometry.coordinates;
        const segments = [];

        function haversineDistance([lon1, lat1], [lon2, lat2]) {
          const R = 6371000; // Earth radius in meters
          const toRad = angle => angle * Math.PI / 180;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat/2)**2 +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon/2)**2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        }

        for (let i = 0; i < coords.length - 1; i++) {
          const [lon1, lat1, alt1] = coords[i];
          const [lon2, lat2, alt2] = coords[i + 1];

          const distance = haversineDistance([lon1, lat1], [lon2, lat2]);

          // Skip if altitude is missing or jump is too big or spatial gap is large
          if (
            alt1 == null || alt2 == null ||
            Math.abs(alt2 - alt1) > 1000 ||
            distance > 200 // skip segments longer than 2km
          ) {
            continue;
          }

          segments.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [lon1, lat1],
                [lon2, lat2]
              ]
            },
            properties: {
              altitudeChange: alt2 - alt1
            }
          });
        }

        feature.properties.segmentLines = segments;
      });

      const gradientLineData = {
        type: 'FeatureCollection',
        features: geojson.features.flatMap(f => f.properties.segmentLines || [])
      };

      const pathData = geojson.features.flatMap((feature) => {
        if (!feature.geometry || feature.geometry.type !== 'LineString') return [];
        return [{
          path: feature.geometry.coordinates,
          color: [0, 120, 255], // optional static color
          name: 'Flight Path'
        }];
      });

      window.deckFlightPathData = pathData;
      if (window.map && pathData.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
      
        pathData.forEach(({ path }) => {
          path.forEach(coord => {
            bounds.extend([coord[0], coord[1]]);
          });
        });
      
        if (!bounds.isEmpty()) {
          window.map.fitBounds(bounds, { padding: 40, pitch: 45, bearing: 0 });
        }
      } // store globally for DeckGL access

      map.addSource('kml-source', {
        type: 'geojson',
        data: gradientLineData
      });

      // Add the gradient line layer
      map.addLayer({
        id: 'altitude-gradient-line',
        type: 'line',
        source: 'kml-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-width': 4,
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'altitudeChange'],
            -10, '#d7191c',
             0, '#ffffff',
            10, '#1a9641'
          ]
        }
      });

      const bounds = new mapboxgl.LngLatBounds();
      if (!geojson.features || geojson.features.length === 0) {
        console.warn("No features found in the uploaded KML file.");
        return;
      }
      geojson.features.forEach((feature) => {
        if (!feature.geometry) return;
        const coords = feature.geometry.coordinates;
        const type = feature.geometry.type;

        if (type === 'Point') {
          bounds.extend(coords);
        } else if (type === 'LineString' || type === 'MultiPoint') {
          coords.forEach(c => bounds.extend(c));
        } else if (type === 'Polygon') {
          coords[0].forEach(c => bounds.extend(c));
        } else if (type === 'MultiLineString' || type === 'MultiPolygon') {
          coords.flat(2).forEach(c => bounds.extend(c));
        }
      });

      const hasValidBounds = bounds.isEmpty() === false && bounds.getNorthEast() && bounds.getSouthWest();
      if (hasValidBounds) {
        map.fitBounds(bounds, { padding: 40 });
      }
      if (onUploadComplete) {
        onUploadComplete();
      }
    };

    reader.readAsText(file);

    setUploadedFile(file);
    setUploading(true);
    setUploadProgress(0);

    // Simulate file upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          return 100;
        }
        return prev + 10; // Increase progress by 10% every 500ms
      });
    }, 500);
  };

  return (
    /* From Uiverse.io by themrsami */
    <div className="group relative w-[420px]">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-cyan-500/10">
        <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-sky-500/0 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-70"></div>
        <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/0 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-70"></div>

        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Upload Files</h3>
              <p className="text-sm text-slate-400">Drag &amp; drop your files here</p>
            </div>
            <button className="rounded-lg bg-cyan-500/10 p-2">
              <svg className="h-6 w-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M10.0303 8.96965C9.73741 8.67676 9.26253 8.67676 8.96964 8.96965C8.67675 9.26255 8.67675 9.73742 8.96964 10.0303L10.9393 12L8.96966 13.9697C8.67677 14.2625 8.67677 14.7374 8.96966 15.0303C9.26255 15.3232 9.73743 15.3232 10.0303 15.0303L12 13.0607L13.9696 15.0303C14.2625 15.3232 14.7374 15.3232 15.0303 15.0303C15.3232 14.7374 15.3232 14.2625 15.0303 13.9696L13.0606 12L15.0303 10.0303C15.3232 9.73744 15.3232 9.26257 15.0303 8.96968C14.7374 8.67678 14.2625 8.67678 13.9696 8.96968L12 10.9393L10.0303 8.96965Z" fill="#06b6d4"></path> <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="#06b6d4"></path>
              </svg>
            </button>
          </div>

          <div className="group/dropzone mt-6">
            <div 
              className={`relative rounded-xl border-2 p-8 transition-colors ${isDragActive ? 'border-cyan-500 bg-slate-800/70' : 'border-dashed border-slate-700 bg-slate-900/50'} hover:border-cyan-500 hover:bg-slate-800/70`} 
              onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragActive(false); handleFileChange(e); }}
            >
              <input
                type="file"
                accept=".kml"
                className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
                multiple
                onChange={handleFileChange}
              />
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-900">
                  <svg
                    className="h-10 w-10 text-cyan-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                </div>

                <div className="space-y-2 text-white">
                  {uploading ? (
                    <p className="text-base font-medium">Uploading: {uploadedFile ? uploadedFile.name : 'File'}</p>
                  ) : (
                    <>
                      <p className="text-base font-medium">Drop your files here or browse</p>
                      <p className="text-sm text-slate-400">Support files: KML</p>
                      <p className="text-xs text-slate-400">Max file size: 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
          )}

          {uploading && (
            <div className="mt-6 rounded-xl bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-500/10 p-2">
                    <svg
                      className="h-6 w-6 text-cyan-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {uploadedFile ? uploadedFile.name : 'File'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {uploadProgress}% {uploadedFile ? uploadedFile.type.toUpperCase() : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-cyan-500">{uploadProgress}%</span>
                  <button className="text-slate-400 transition-colors hover:text-white">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="h-full w-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent"></div>
                </div>
              </div>
            </div>
          )}

          {/* <div className="mt-6 grid grid-cols-2 gap-4">
            <button className="group/btn relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 p-px font-medium text-white shadow-[0_1000px_0_0_hsl(0_0%_100%_/_0%)_inset] transition-colors hover:shadow-[0_1000px_0_0_hsl(0_0%_100%_/_2%)_inset]">
              <span className="relative flex items-center justify-center gap-2 rounded-xl bg-slate-950/50 px-4 py-2 transition-colors group-hover/btn:bg-transparent">
                Upload More
                <svg className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  ></path>
                </svg>
              </span>
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800">
              Clear All
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export default Upload;