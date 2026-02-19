"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Settings, Zap, RefreshCw, FileSpreadsheet, Upload, AlertCircle, Terminal, Code, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from 'axios';

// --- CONFIGURATION ---
const API_ENDPOINT = "http://localhost:5555/upload";
const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

const getVehicleColor = (index) => {
  const colors = ["#22d3ee", "#a855f7", "#f472b6", "#fbbf24", "#34d399", "#f87171"];
  return colors[index % colors.length];
};

// --- HELPERS: TIME CONVERSION ---
const excelTimeToHHMMSS = (serial) => {
  if (typeof serial === 'string') return serial; 
  if (typeof serial !== 'number') return '08:00:00';
  const totalSeconds = Math.floor(serial * 24 * 3600);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] * 60) + (parts[1] || 0); 
};

const minutesToDurationText = (totalMins) => {
  if (totalMins < 0) return "0 min";
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
};

export default function ControlPanel({ file, onDataGenerated, onReupload }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statusMsg, setStatusMsg] = useState("Waiting...");
  const [errorMsg, setErrorMsg] = useState(null);
  const [debugData, setDebugData] = useState(null);
  
  const lastProcessedFile = useRef(null);

  useEffect(() => {
    if (file && file !== lastProcessedFile.current) {
        handleUploadAndOptimize(file);
    }
  }, [file]);

  const sheetToCSVBlob = (workbook, sheetName) => {
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ",", RS: "\n", blankrows: false });
    return new Blob([csv], { type: "text/csv" });
  };

  const findSheet = (names, target) => {
    return names.find(n => n.toLowerCase().includes(target.toLowerCase()));
  };

  // --- Robust column matcher ---
  const findValue = (row, aliases) => {
    const keys = Object.keys(row);
    for (let alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[\s_]/g, '');
      const key = keys.find(k => k.toLowerCase().replace(/[\s_]/g, '') === cleanAlias);
      if (key) return row[key];
    }
    return null;
  };

  // --- Safer CSV parser ---
  const parseServerCSV = (csvString) => {
    if (!csvString) return [];
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
      return obj;
    });
  };

  const fetchRealRoadPath = async (waypoints) => {
    if (waypoints.length < 2) return { path: waypoints, distance: 0 };
    const coordString = waypoints.map(p => `${p[1]},${p[0]}`).join(';');
    try {
      const url = `${OSRM_BASE_URL}/${coordString}?overview=full&geometries=geojson&continue_straight=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length > 0) {
        const route = data.routes[0];
        return {
          path: route.geometry.coordinates.map(c => [c[1], c[0]]),
          distance: (route.distance / 1000).toFixed(1),
        };
      }
    } catch (e) {
      console.warn("OSRM failed, using straight line", e);
    }
    return { path: waypoints, distance: 0 };
  };

  const handleUploadAndOptimize = async (uploadedFile) => {
    setLoading(true);
    setStatusMsg("Reading Excel...");
    setErrorMsg(null);
    setDebugData(null);
    
    lastProcessedFile.current = uploadedFile;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        console.log("📂 Excel Loaded");

        const excelData = e.target.result;
        const workbook = XLSX.read(excelData, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        
        const empSheet = findSheet(sheetNames, 'employee') || findSheet(sheetNames, 'request');
        const vehSheet = findSheet(sheetNames, 'vehicle') || findSheet(sheetNames, 'fleet');
        const metaSheet = findSheet(sheetNames, 'metadata') || findSheet(sheetNames, 'config');

        if (!empSheet) throw new Error("Missing 'Employees' sheet.");

        // --- Extract employee coordinates ---
        const empRaw = XLSX.utils.sheet_to_json(workbook.Sheets[empSheet]);
        const locationMap = {};
        let totalEmployees = 0;
        empRaw.forEach(row => {
          const id = findValue(row, ['id', 'employee', 'employee_id']) || row.employee_id || row.id || row.ID;
          const pLat = parseFloat(findValue(row, ['pickup_lat', 'pickuplatitude', 'lat', 'latitude']) || row.pickup_lat || row.lat || row.Lat);
          const pLng = parseFloat(findValue(row, ['pickup_lng', 'pickuplongitude', 'lng', 'longitude']) || row.pickup_lng || row.lng || row.Lng);
          const dLat = parseFloat(findValue(row, ['drop_lat', 'droplatitude', 'officelat']) || row.drop_lat || row.drop_latitude);
          const dLng = parseFloat(findValue(row, ['drop_lng', 'droplongitude', 'officelng']) || row.drop_lng || row.drop_longitude);
          if (id && pLat && pLng) {
            locationMap[id] = { 
              pickup: [pLat, pLng], 
              drop: (dLat && dLng) ? [dLat, dLng] : null 
            };
            totalEmployees++;
          }
        });

        // --- Extract vehicle details (including dashboard fields) ---
        const vehicleDetailsMap = {};
        if (vehSheet) {
          const vehRaw = XLSX.utils.sheet_to_json(workbook.Sheets[vehSheet]);
          vehRaw.forEach(row => {
            const vId = findValue(row, ['vehicle', 'vehicle_id', 'id']) || row.vehicle_id || row.id || row.ID;
            const lat = parseFloat(findValue(row, ['current_lat', 'start_lat', 'lat']) || row.current_lat || row.start_lat);
            const lng = parseFloat(findValue(row, ['current_lng', 'start_lng', 'lng']) || row.current_lng || row.start_lng);
            let available_from = findValue(row, ['available_from', 'start_time']) || row.available_from;
            const type = findValue(row, ['type', 'category', 'class', 'vehicle_type']) || row.category || row.vehicle_type || "Normal";
            const fuel = findValue(row, ['fuel', 'propulsion', 'engine', 'fuel_type']) || row.fuel_type || "Electric";
            const capacity = parseInt(findValue(row, ['capacity', 'seats', 'max_passengers']) || row.capacity || 4) || 4;

            if (typeof available_from === 'number') {
              available_from = excelTimeToHHMMSS(available_from);
            }
            
            if (vId) {
              vehicleDetailsMap[vId] = {
                lat: !isNaN(lat) ? lat : null,
                lng: !isNaN(lng) ? lng : null,
                available_from: available_from || '08:00:00',
                type,
                fuel,
                capacity
              };
            }
          });
        }

        // --- Send to backend ---
        const formData = new FormData();
        formData.append('employees', sheetToCSVBlob(workbook, empSheet), 'employees.csv');
        if (vehSheet) formData.append('vehicles', sheetToCSVBlob(workbook, vehSheet), 'vehicles.csv');
        if (metaSheet) formData.append('metadata', sheetToCSVBlob(workbook, metaSheet), 'metadata.csv');

        setStatusMsg("Optimizing (Backend)...");
        const response = await axios.post(API_ENDPOINT, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const result = response.data;
        setDebugData(JSON.stringify(result, null, 2));

        // --- Parse assignments ---
        let assignments = [];
        if (result.results?.ALNS?.csv_vehicle) {
           assignments = parseServerCSV(result.results.ALNS.csv_vehicle);
        }

        if (assignments.length === 0) throw new Error("No vehicle assignments returned.");

        // --- Group stops by vehicle ---
        const vehicleGroups = {};
        const vehicleInfo = {};

        assignments.forEach(row => {
          const vId = row.vehicle_id;
          const vDetails = vehicleDetailsMap[vId] || { type: "Normal", fuel: "Electric", capacity: 4 };

          if (!vehicleGroups[vId]) {
            vehicleGroups[vId] = [];
            vehicleInfo[vId] = vDetails;
          }

          const empId = row.employee_id;
          const locs = locationMap[empId];

          if (locs) {
            if (locs.pickup) {
              vehicleGroups[vId].push({
                type: 'pickup',
                time: row.pickup_time,
                id: empId,
                lat: locs.pickup[0],
                lng: locs.pickup[1]
              });
            }
            if (locs.drop) {
              const last = vehicleGroups[vId][vehicleGroups[vId].length - 1];
              const isSameAsLast = last && last.lat === locs.drop[0] && last.lng === locs.drop[1];
              if (!isSameAsLast) {
                vehicleGroups[vId].push({
                  type: 'drop',
                  time: row.drop_time,
                  id: "OFFICE",
                  lat: locs.drop[0],
                  lng: locs.drop[1]
                });
              }
            }
          }
        });

        // --- Build routes with real road paths ---
        setStatusMsg("Calculating Schedules...");
        const parsedRoutes = await Promise.all(
          Object.keys(vehicleGroups).map(async (vId, index) => {
            let stops = vehicleGroups[vId].sort((a, b) => a.time.localeCompare(b.time));
            const vDetails = vehicleInfo[vId] || {};

            // Duration
            let durationText = "0 min";
            if (stops.length > 0) {
                const firstTask = stops[0]; 
                const lastTask = stops[stops.length - 1]; 
                const startMin = timeToMinutes(firstTask.time);
                const endMin = timeToMinutes(lastTask.time);
                durationText = minutesToDurationText(endMin - startMin);
            }

            // Add depot if coordinates exist
            if (vDetails.lat && vDetails.lng) {
              stops.unshift({
                type: 'start',
                time: vDetails.available_from || '08:00:00',
                id: 'DEPOT',
                lat: vDetails.lat,
                lng: vDetails.lng
              });
            }

            const waypoints = stops.map(s => [s.lat, s.lng]);
            let roadData = { path: waypoints, distance: 0 };
            if (waypoints.length > 1) {
              roadData = await fetchRealRoadPath(waypoints);
            }

            const passengers = stops.filter(s => s.type === 'pickup').map(s => s.id);

            return {
              vehicleId: vId,
              color: getVehicleColor(index),
              path: roadData.path,
              stops: stops.map((s, i) => ({
                lat: s.lat,
                lng: s.lng,
                sequence: i,
                type: s.type,
                id: s.id,
                time: s.time
              })),
              distance: roadData.distance ? `${roadData.distance} km` : "0 km",
              duration: durationText,
              passengers: passengers,
              startTime: stops[0]?.time || "08:00",
              // Dashboard fields
              vehicleType: vDetails.type || "Normal",
              propulsion: vDetails.fuel || "Electric",
              capacity: vDetails.capacity || 4,
              occupancy: passengers.length
            };
          })
        );

        // --- Prepare final data package (INCLUDING RAW ASSIGNMENTS) ---
        const totalDist = parsedRoutes.reduce((acc, r) => acc + parseFloat(r.distance), 0);
        
        const pickupsWithId = [];
        const dropSet = new Set();
        const dropoffs = [];
        Object.entries(locationMap).forEach(([id, l]) => {
          if (l.pickup) pickupsWithId.push({ lat: l.pickup[0], lng: l.pickup[1], id: id });
          if (l.drop) {
            const key = `${l.drop[0]},${l.drop[1]}`;
            if (!dropSet.has(key)) {
              dropSet.add(key);
              dropoffs.push({ lat: l.drop[0], lng: l.drop[1] });
            }
          }
        });

        setStats({
          nodes: totalEmployees,
          routes: parsedRoutes.length,
          efficiency: `${totalDist.toFixed(1)} km Total`,
          cost: "Optimized"
        });

        // 🔥 FIX: Include raw assignments so Employee Assignments table gets populated
        if (onDataGenerated) {
          onDataGenerated({ 
            pickups: pickupsWithId, 
            dropoffs, 
            routes: parsedRoutes,
            rawAssignments: assignments   // <-- THIS WAS MISSING
          });
        }
        setStatusMsg("Ready.");

      } catch (err) {
        console.error("❌ ERROR:", err);
        setErrorMsg(err.message || "Processing Failed");
        setStatusMsg("Error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4 gap-4 overflow-y-auto custom-scrollbar">
      {/* ... (rest of the JSX remains exactly as you wrote it) ... */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400" />
          Velora Control
        </h2>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-cyan-500" />}
      </div>

      {errorMsg && (
        <div className="bg-red-900/20 border border-red-500/50 p-3 rounded text-xs text-red-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4" /> Error</div>
          <span className="opacity-80">{errorMsg}</span>
        </div>
      )}

      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="text-slate-400 text-[10px] font-mono mb-1">EMPLOYEES</div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              {stats.nodes}
            </div>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
            <div className="text-slate-400 text-[10px] font-mono mb-1">VEHICLES</div>
            <div className="text-xl font-bold text-emerald-400">{stats.routes}</div>
          </div>
          <div className="col-span-2 bg-linear-to-r from-cyan-900/20 to-blue-900/20 p-3 rounded-lg border border-cyan-500/30 flex items-center justify-between">
            <div>
              <div className="text-cyan-300 text-[10px] font-mono mb-1">TOTAL FLEET DISTANCE</div>
              <div className="text-2xl font-bold text-white tracking-wider">{stats.efficiency}</div>
            </div>
            <Zap className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      ) : (
        <div className="p-4 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 h-32">
          {loading ? <Terminal className="w-6 h-6 animate-pulse" /> : <FileSpreadsheet className="w-6 h-6" />}
          <span className="text-xs font-mono">{statusMsg}</span>
        </div>
      )}

      {debugData && (!stats || stats.routes === 0) && (
        <div className="mt-4 bg-black/40 p-3 rounded border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold mb-2">
            <Code className="w-3 h-3" /> DEBUG: SERVER RESPONSE
          </div>
          <pre className="text-[10px] text-slate-400 font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all custom-scrollbar">
            {debugData}
          </pre>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => file && handleUploadAndOptimize(file)}
          disabled={loading || !file}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-300 rounded text-xs font-bold transition-colors border border-slate-700"
        >
          {loading ? "PROCESSING..." : "RETRY CONNECTION"}
        </button>

        <button
          onClick={onReupload}
          className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-bold transition-colors shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" /> UPLOAD EXCEL
        </button>
      </div>
    </div>
  );
}