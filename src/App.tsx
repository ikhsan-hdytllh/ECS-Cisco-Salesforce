import { useState, useMemo, useEffect } from 'react';
import { initialDeals, Deal } from './types';
import { SummaryCards } from './components/SummaryCards';
import { DashboardCharts } from './components/DashboardCharts';
import { FunnelStage } from './components/FunnelStage';
import { PipelineTable } from './components/PipelineTable';
import { DealModal } from './components/DealModal';
import { Search, Filter, Download, Plus, LayoutDashboard, LogOut, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { initAuth, googleSignIn, logout, getAccessToken } from './auth';
import { User } from 'firebase/auth';
import { fetchDealsFromSheets, syncDealsToSheets } from './sheets';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters State
  const [filterAM, setFilterAM] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [filterArchi, setFilterArchi] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setNeedsAuth(false);
        loadDealsFromSheets();
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadDealsFromSheets = async () => {
    try {
      setIsLoadingData(true);
      const data = await fetchDealsFromSheets();
      if (data.length === 0) {
        // If empty, initialize with dummy data and persist
        setDeals(initialDeals);
        await syncDealsToSheets(initialDeals);
      } else {
        setDeals(data);
      }
    } catch (err) {
      console.error('Failed to load deals from sheets:', err);
      // Fallback
      setDeals(initialDeals);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await loadDealsFromSheets();
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setDeals([]);
  };

  // Derived Option Lists for Filters
  const amList = Array.from(new Set(deals.map(d => d.AM_Cisco))).filter(Boolean).sort();
  const partnerList = Array.from(new Set(deals.map(d => d.Partner))).filter(Boolean).sort();
  const archiList = Array.from(new Set(deals.map(d => d.Archi))).filter(Boolean).sort();
  const quarterList = Array.from(new Set(deals.map(d => d.Estimate_Close))).filter(Boolean).sort();

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (deal.Enduser || '').toLowerCase().includes(searchLower) ||
        (deal.Product || '').toLowerCase().includes(searchLower) ||
        (deal.DID || '').toLowerCase().includes(searchLower);

      const matchesAM = filterAM === '' || deal.AM_Cisco === filterAM;
      const matchesPartner = filterPartner === '' || deal.Partner === filterPartner;
      const matchesArchi = filterArchi === '' || deal.Archi === filterArchi;
      const matchesStage = filterStage === '' || deal.Stage?.toString() === filterStage;
      const matchesQuarter = filterQuarter === '' || deal.Estimate_Close === filterQuarter;

      return matchesSearch && matchesAM && matchesPartner && matchesArchi && matchesStage && matchesQuarter;
    });
  }, [deals, searchTerm, filterAM, filterPartner, filterArchi, filterStage, filterQuarter]);

  const handleSaveDeal = async (deal: Deal) => {
    let newDeals;
    if (editingDeal) {
      newDeals = deals.map((d) => (d.id === deal.id ? deal : d));
    } else {
      newDeals = [...deals, deal];
    }
    setDeals(newDeals);
    try {
      await syncDealsToSheets(newDeals);
    } catch (e) {
      console.error('Failed to sync changes to sheets', e);
      alert('Failed to save to Google Sheets. Changes are local only.');
    }
  };

  const handleDeleteDeal = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this deal? This action will update your Google Sheets.')) {
      const newDeals = deals.filter((d) => d.id !== id);
      setDeals(newDeals);
      try {
        await syncDealsToSheets(newDeals);
      } catch (e) {
        console.error('Failed to sync changes to sheets', e);
        alert('Failed to delete from Google Sheets. Change is local only.');
      }
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredDeals.map(({ id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
    XLSX.writeFile(wb, "Cisco_Sales_Pipeline.xlsx");
  };

  if (needsAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans text-slate-800">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <LayoutDashboard className="w-8 h-8 text-cisco-blue" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">ECS Cisco Sales Pipeline</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in with your Google Workspace account to access and sync deals.</p>
          
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-md px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            )}
            {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-cisco-blue animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-slate-800">Loading Pipeline Data...</h2>
        <p className="text-gray-500">Syncing from Google Sheets</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      {/* HEADER NAVBAR */}
      <header className="bg-cisco-dark text-white shadow-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-cisco-blue shrink-0" />
            <h1 className="text-xl font-bold tracking-tight">ECS Cisco Sales Pipeline</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-xs font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-sm">
                <p className="font-semibold leading-tight">{user?.displayName || 'User'}</p>
                <p className="text-xs text-blue-200 opacity-80 leading-tight">{user?.email}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setEditingDeal(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-cisco-blue hover:bg-[#038bc2] text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm ml-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-md transition-colors tooltip flex items-center gap-2"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        
        {/* SUMMARY CARDS */}
        <SummaryCards deals={filteredDeals} />

        {/* CHARTS & FUNNEL ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DashboardCharts deals={filteredDeals} />
          </div>
          <div className="lg:col-span-1">
            <FunnelStage deals={filteredDeals} />
          </div>
        </div>

        {/* FILTERS AND TABLE AREA */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* TOOLBAR */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col 2xl:flex-row gap-4 justify-between items-start 2xl:items-center">
            
            {/* Search */}
            <div className="relative w-full 2xl:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Enduser, BDM/PS, DID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-cisco-blue/40"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full 2xl:w-auto">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters:</span>
              </div>
              
              <select value={filterAM} onChange={(e) => setFilterAM(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-cisco-blue/50 bg-white min-w-[120px]">
                <option value="">All AM Cisco</option>
                {amList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-cisco-blue/50 bg-white min-w-[120px]">
                <option value="">All Partners</option>
                {partnerList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterArchi} onChange={(e) => setFilterArchi(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-cisco-blue/50 bg-white min-w-[120px]">
                <option value="">All Archi</option>
                {archiList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-cisco-blue/50 bg-white min-w-[120px]">
                <option value="">All Stages</option>
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="90">90%</option>
                <option value="100">100%</option>
              </select>

              <select value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-cisco-blue/50 bg-white min-w-[120px]">
                <option value="">All Quarters</option>
                {quarterList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <div className="flex-1"></div>
              
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 px-3 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>

          {/* TABLE COMPONENT */}
          <PipelineTable
            deals={filteredDeals}
            onEdit={(deal) => {
              setEditingDeal(deal);
              setIsModalOpen(true);
            }}
            onDelete={handleDeleteDeal}
          />
        </div>
      </main>

      {/* MODAL */}
      <DealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDeal}
        editingDeal={editingDeal}
      />
    </div>
  );
}

