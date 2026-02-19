"use client";

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from "framer-motion";

import { 
  FileText, ArrowLeft, ArrowRight, Loader2, ShieldCheck, 
  Map as MapIcon, Car, BarChart3, Bell, User, Navigation, LayoutDashboard,
  Clock, Fuel, Users, MapPin, Timer
} from 'lucide-react';

const CyberpunkGlobe = dynamic(() => import('../components/CyberpunkGlobe'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-950" />
});

const MapBoard = dynamic(() => import('../components/MapBoard'), { 
  ssr: false, 
  loading: () => <div className="w-full h-full bg-slate-900 flex items-center justify-center text-cyan-500 font-mono animate-pulse">INITIALIZING SATELLITE LINK...</div>
});

import ResultsPanel from '../components/ResultsPanel';
import ControlPanel from '../components/ControlPanel';

// --- HELPER: Calculate duration between two HH:MM strings ---
const calculateDuration = (start, end) => {
  if (!start || !end || start === '--:--' || end === '--:--') return 'N/A';
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  let diff = endMins - startMins;
  if (diff < 0) diff += 24 * 60; 
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${mins} min`;
};

export default function HomePage() {
  const [view, setView] = useState('landing'); 
  const [activeTab, setActiveTab] = useState('map'); 
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapData, setMapData] = useState({ pickups: [], dropoffs: [], routes: [], rawAssignments: [] });
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(null);
  const [simulatingVehicleIndex, setSimulatingVehicleIndex] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleProceed = () => {
    if (!file) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setView('dashboard'); 
    }, 1000); 
  };

  const handleDataGenerated = (data) => {
    setMapData(data);
  };

  const resetApp = () => {
    setFile(null);          
    setMapData({ pickups: [], dropoffs: [], routes: [], rawAssignments: [] }); 
    setSelectedVehicleIndex(null); 
    setSimulatingVehicleIndex(null);
    setView('landing');     
  };

  const handleSimulate = (index) => {
    setSelectedVehicleIndex(index);
    setSimulatingVehicleIndex(index);
  };

  const handleSimulationEnd = () => {
    setSimulatingVehicleIndex(null);
  };

  useEffect(() => {
    if (selectedVehicleIndex !== simulatingVehicleIndex) {
      setSimulatingVehicleIndex(null);
    }
  }, [selectedVehicleIndex, simulatingVehicleIndex]);

  const startResizing = (e) => setIsResizing(true);

  useEffect(() => {
    const resize = (e) => {
      if (isResizing) {
        const newWidth = Math.min(Math.max(e.clientX, 300), 800);
        setSidebarWidth(newWidth);
      }
    };
    const stopResizing = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  if (view === 'dashboard') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className={`relative w-full h-screen bg-slate-950 flex flex-col font-sans overflow-hidden text-white ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
        
        <nav className="flex items-center justify-between px-6 h-16 bg-slate-900 border-b border-cyan-900/30 z-50 shadow-lg flex-none">
          <div className="flex items-center gap-6">
            <button onClick={resetApp} className="group flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors text-xs font-bold uppercase tracking-wider border border-slate-700 rounded px-3 py-1.5 hover:border-cyan-500/50 hover:bg-cyan-950/30">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> BACK
            </button>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-linear-to-tr from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(34,211,238,0.3)]">V</div>
               <span className="text-xl font-black tracking-widest text-white">VELORA</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-1 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <MapIcon className="w-4 h-4" /> Map View
            </button>
            <button onClick={() => setActiveTab('dashboard_view')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'dashboard_view' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-cyan-400 relative transition-colors"><Bell className="w-5 h-5" /><span className="absolute top-0 right-0 w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span></button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
              <div className="text-right hidden md:block"><div className="text-sm font-bold text-white">Admin User</div></div>
              <div className="w-9 h-9 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-cyan-400"><User className="w-5 h-5" /></div>
            </div>
          </div>
        </nav>
        
        <div className="flex-1 flex overflow-hidden bg-slate-900 relative">
          
          {/* VIEW 1: MAP BOARD */}
          <div className={`absolute inset-0 flex ${activeTab === 'map' ? 'z-10' : 'z-0 invisible'}`}>
            <div ref={sidebarRef} style={{ width: sidebarWidth }} className="flex-none bg-slate-900 flex flex-col border-r border-slate-800 z-20 shadow-2xl relative">
              <div className="flex-none bg-slate-900 z-30 border-b border-slate-800 shadow-lg">
                <ControlPanel file={file} onDataGenerated={handleDataGenerated} onReupload={resetApp} /> 
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-900/50">
                <ResultsPanel 
                  data={mapData} 
                  onVehicleSelect={setSelectedVehicleIndex} 
                  selectedIndex={selectedVehicleIndex}
                  onSimulateClick={handleSimulate}
                />
              </div>
              <div onMouseDown={startResizing} className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 hover:bg-cyan-500 transition-colors ${isResizing ? 'bg-cyan-500' : 'bg-transparent'}`} />
            </div>
            <div className="flex-1 relative bg-slate-900 z-10">
              <MapBoard 
                pickups={mapData.pickups} 
                dropoffs={mapData.dropoffs} 
                routes={mapData.routes} 
                selectedRouteIndex={selectedVehicleIndex}
                simulatingVehicleIndex={simulatingVehicleIndex}
                onSimulationEnd={handleSimulationEnd}
              />
            </div>
          </div>

          {/* VIEW 2: DASHBOARD TABLE (ENHANCED) */}
          <div className={`absolute inset-0 bg-slate-900 ${activeTab === 'dashboard_view' ? 'z-20 overflow-y-auto' : 'z-0 hidden'}`}>
            <div className="w-full h-full p-8 bg-slate-900 overflow-y-auto text-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <LayoutDashboard className="text-cyan-400"/> Live Fleet Manifest
                </h2>
                <p className="text-slate-400 text-sm mt-1 font-mono">Synchronized with: {file?.name || 'No file'}</p>
              </div>

              {/* FLEET MANIFEST TABLE */}
              <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-12 shadow-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 border-b border-slate-700">
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Vehicle ID</th>
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Type</th>
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Occupancy</th>
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Distance</th>
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Est. Duration</th>
                      <th className="p-4 font-bold text-cyan-400 text-xs uppercase tracking-wider">Propulsion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mapData.routes && mapData.routes.length > 0 ? (
                      mapData.routes.map((route, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="p-4 font-mono text-white text-sm">
                            {route.vehicleId}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[10px] border uppercase font-bold tracking-wider ${
                              (route.vehicleType || 'Normal').toLowerCase() === 'premium' 
                                ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' 
                                : 'bg-slate-800 border-slate-600 text-slate-400'
                            }`}>
                              {route.vehicleType || 'Normal'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-cyan-950/40 rounded text-[10px] border border-cyan-500/30 text-cyan-300">
                              {route.occupancy || route.passengers?.length || 0} / {route.capacity || 4} Seats
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                            <div className="flex items-center gap-2 font-mono">
                              <Navigation className="w-3 h-3 text-cyan-500" />
                              {route.distance}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {route.duration || 'N/A'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-xs font-mono capitalize">
                              <Fuel className="w-3 h-3 text-slate-500" />
                              {route.propulsion || 'Electric'}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-12 text-center text-slate-500 font-mono italic">
                          Waiting for optimization data from server...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* EMPLOYEE ASSIGNMENTS TABLE */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="text-emerald-400"/> Employee Assignments
                </h2>
                <p className="text-slate-400 text-sm mt-1 font-mono">Individual pickup schedules & vehicle assignments</p>
              </div>

              <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm shadow-lg mb-24">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 border-b border-slate-700">
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">Employee ID</th>
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">Assigned Vehicle</th>
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">Type</th>
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">Start Time</th>
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">End Time</th>
                      <th className="p-4 font-bold text-emerald-400 text-xs uppercase tracking-wider">Total Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mapData.rawAssignments && mapData.rawAssignments.length > 0 ? (
                      mapData.rawAssignments.map((assignment, idx) => (
                        <tr key={`emp-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 font-mono text-emerald-300 text-sm font-bold">
                            {assignment.employee_id || 'N/A'}
                          </td>
                          <td className="p-4 font-mono text-white text-sm">
                            <div className="flex items-center gap-2">
                               <Car className="w-4 h-4 text-slate-500" />
                               {assignment.vehicle_id || 'N/A'}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[10px] border uppercase font-bold tracking-wider ${
                              (assignment.category || 'Normal').toLowerCase() === 'premium' 
                                ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' 
                                : 'bg-slate-800 border-slate-600 text-slate-400'
                            }`}>
                              {assignment.category || 'Normal'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                            <div className="flex items-center gap-2 font-mono">
                              <MapPin className="w-3 h-3 text-emerald-500" />
                              {assignment.pickup_time || '--:--'}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                             <div className="flex items-center gap-2 font-mono">
                                <MapPin className="w-3 h-3 text-red-500" />
                                {assignment.drop_time || '--:--'}
                             </div>
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                             <div className="flex items-center gap-2 font-mono">
                                <Timer className="w-3 h-3 text-cyan-500" />
                                {calculateDuration(assignment.pickup_time, assignment.drop_time)}
                             </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-12 text-center text-slate-500 font-mono italic">
                          Waiting for individual assignment data...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VIEW 3: ANALYTICS */}
          <div className={`absolute inset-0 bg-slate-900 ${activeTab === 'analytics' ? 'z-20 overflow-y-auto' : 'z-0 hidden'}`}>
            <div className="p-8 h-full text-white custom-scrollbar">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <BarChart3 className="text-cyan-400"/> Operational Analytics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-400 text-sm font-bold uppercase">Total Missions</h3>
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><FileText className="w-5 h-5"/></div>
                  </div>
                  <p className="text-4xl font-black text-white">{mapData.routes.length}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-400 text-sm font-bold uppercase">Stops Serviced</h3>
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg"><Car className="w-5 h-5"/></div>
                  </div>
                  <p className="text-4xl font-black text-white">
                    {mapData.routes.reduce((acc, curr) => acc + (curr.stops?.length || 0), 0)}
                  </p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-400 text-sm font-bold uppercase">Total Distance</h3>
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><Navigation className="w-5 h-5"/></div>
                  </div>
                  <p className="text-4xl font-black text-white">
                    {mapData.routes.reduce((acc, curr) => acc + parseFloat(curr.distance || 0), 0).toFixed(1)} <span className="text-lg text-slate-500">km</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    );
  }

  // LANDING PAGE
  return (
    <motion.div exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} transition={{ duration: 0.8 }} className="relative w-full min-h-screen overflow-hidden flex flex-col items-center justify-center font-sans bg-slate-950">
      <CyberpunkGlobe />
      <main className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center text-center space-y-12">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-7xl md:text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_40px_rgba(34,211,238,0.5)]">VELORA</h1>
          <p className="text-cyan-300/80 text-xl font-mono tracking-widest uppercase">Global Neural Routing System</p>
        </div>
        <div className="w-full max-w-xs animate-in zoom-in duration-500 delay-150">
          <div onClick={() => !file && fileInputRef.current?.click()} className={`relative group cursor-pointer h-50 backdrop-blur-md border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center justify-center p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${file ? 'border-emerald-500/50 bg-emerald-950/40' : 'border-white/20 hover:border-cyan-400 bg-slate-900/60 hover:bg-slate-900/80'}`}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.xlsx,.xls,.json" />
            {!file ? (
              <div className="flex flex-col items-center gap-4 pointer-events-none">
                <div className="w-14 h-14 rounded-xl bg-slate-800/50 border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 group-hover:shadow-cyan-500/20"><FileText className="w-8 h-8 text-cyan-400" /></div>
                <div className="space-y-1"><h3 className="text-lg font-bold text-white">Upload Mission Data</h3><p className="text-xs text-cyan-200/50 font-mono">.CSV or .XLSX</p></div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full animate-in zoom-in">
                <ShieldCheck className="w-14 h-14 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <div className="text-center">
                   <h3 className="text-lg font-bold text-white tracking-tight mb-4">{file.name}</h3>
                   <button onClick={(e) => { e.stopPropagation(); handleProceed(); }} className="px-8 py-3 bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center gap-3 mx-auto transition-all active:scale-95">
                     {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : "INITIALIZE MAP"} <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </motion.div>
  );
}