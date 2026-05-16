// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Import D3 as an ESM module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// ==========================================
// MAP INITIALIZATION
// ==========================================
// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoia2FuZ2xlZTA1IiwiYSI6ImNtcDdmOXd0cjAxNjgycnE5eXUxcmt4eHEifQ.cj37zNS0iv8aQwGVchNVIg';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style (Update if you made a custom one!)
  center: [-71.09415, 42.36027], // [longitude, latitude] for Boston/Cambridge
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================
// Function to convert geo-coordinates to pixel coordinates on the screen
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point); // Project to pixel coordinates
  return { cx: x, cy: y }; // Return as object for use in SVG attributes
}

// ==========================================
// DATA FETCHING & VISUALIZATION
// ==========================================
// Wait for the map to fully load before adding data overlays
map.on('load', async () => {
  
  // ----------------------------------------
  // STEP 2: BIKE LANES (Mapbox Layers)
  // ----------------------------------------
  const bikeLaneStyle = {
    'line-color': '#32D400',
    'line-width': 5,
    'line-opacity': 0.6
  };

  // Boston Bike Lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: bikeLaneStyle,
  });

  // Cambridge Bike Lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/master/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLaneStyle,
  });

  // ----------------------------------------
  // STEP 3 & 4: BLUEBIKES DATA (D3 SVG Overlay)
  // ----------------------------------------
  
  let jsonData;
  let trips;
  
  try {
    // Fetch Station JSON
    jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
    console.log('Loaded Station JSON Data:', jsonData);
    
    // Fetch Traffic CSV
    trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv');
    console.log('Loaded Traffic CSV Data:', trips);
  } catch (error) {
    console.error('Error loading data:', error);
  }

  // Extract stations array
  let stations = jsonData.data.stations;

  // Calculate departures and arrivals per station using d3.rollup
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Merge the traffic data into the stations array
  stations = stations.map((station) => {
    let id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });

  console.log('Updated Stations Array with Traffic:', stations);

  // Create a square root scale for circle radius based on total traffic
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // Select the SVG element inside the map container
  const svg = d3.select('#map').select('svg');

  // Append circles to the SVG for each station
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', (d) => radiusScale(d.totalTraffic)) // Dynamic radius based on traffic
    // Note: fill, stroke, and pointer-events are handled in map.css!
    .each(function (d) {
      // Add <title> for browser tooltips
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  // Function to update circle positions when the map moves/zooms
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)  // Set x-position using projected coordinates
      .attr('cy', (d) => getCoords(d).cy); // Set y-position using projected coordinates
  }

  // Initial position update when map loads
  updatePositions();

  // Bind the update function to Mapbox events so markers stay attached to the map
  map.on('move', updatePositions);     
  map.on('zoom', updatePositions);     
  map.on('resize', updatePositions);   
  map.on('moveend', updatePositions); 
});