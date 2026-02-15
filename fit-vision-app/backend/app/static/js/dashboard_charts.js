// static/js/dashboard_charts.js

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid
} from 'https://cdn.skypack.dev/recharts@2.12.7';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

/**
 * Fetches data from a given API endpoint.
 * @param {string} url - The API endpoint URL.
 * @returns {Promise<Array>} - A promise that resolves to the data array.
 */
async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    return [];
  }
}

/**
 * Renders a Pie Chart for workout duration by type.
 * @param {Array} data - The data for the chart.
 * @param {string} containerId - The ID of the DOM element to render the chart in.
 */
function renderWorkoutByTypeChart(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) {
    if (container) container.innerHTML = '<p class="text-center text-gray-500">No workout data available.</p>';
    return;
  }

  const chart = (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="duration_minutes"
          nameKey="type"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value} min`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
  ReactDOM.render(chart, container);
}

/**
 * Renders a Stacked Bar Chart for daily macronutrient consumption.
 * @param {Array} data - The data for the chart.
 * @param {string} containerId - The ID of the DOM element to render the chart in.
 */
function renderDailyMacrosChart(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) {
    if (container) container.innerHTML = '<p class="text-center text-gray-500">No macronutrient data available.</p>';
    return;
  }

  const chart = (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="protein_g" stackId="a" fill="#8884d8" name="Protein (g)" />
        <Bar dataKey="carbs_g" stackId="a" fill="#82ca9d" name="Carbs (g)" />
        <Bar dataKey="fat_g" stackId="a" fill="#ffc658" name="Fat (g)" />
      </BarChart>
    </ResponsiveContainer>
  );
  ReactDOM.render(chart, container);
}

/**
 * Renders a Bar Chart for time asleep by sleep quality.
 * @param {Array} data - The data for the chart.
 * @param {string} containerId - The ID of the DOM element to render the chart in.
 */
function renderSleepQualityChart(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) {
    if (container) container.innerHTML = '<p class="text-center text-gray-500">No sleep quality data available.</p>';
    return;
  }

  const chart = (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="quality" />
        <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => `${value} hours`} />
        <Legend />
        <Bar dataKey="total_hours" fill="#00C49F" name="Total Hours" />
      </BarChart>
    </ResponsiveContainer>
  );
  ReactDOM.render(chart, container);
}

/**
 * Main function to load and render all dashboard charts.
 */
async function loadDashboardCharts() {
  // Ensure ReactDOM is available (it should be loaded via a script tag in dashboard.html)
  if (typeof ReactDOM === 'undefined') {
    console.error("ReactDOM is not loaded. Please ensure React and ReactDOM are included before this script.");
    return;
  }

  // Fetch all data concurrently
  const [workoutData, macrosData, sleepData] = await Promise.all([
    fetchData('/api/workout_summary_by_type'),
    fetchData('/api/daily_macros'),
    fetchData('/api/sleep_summary_by_quality')
  ]);

  // Render charts
  renderWorkoutByTypeChart(workoutData, 'workoutByTypeChart');
  renderDailyMacrosChart(macrosData, 'dailyMacrosChart');
  renderSleepQualityChart(sleepData, 'sleepQualityChart');
}

// Run the chart loading function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadDashboardCharts);