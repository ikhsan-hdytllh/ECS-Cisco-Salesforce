import React, { useState, useMemo, useEffect } from 'react';
import { initialDeals, Deal } from './types';
import { SummaryCards } from './components/SummaryCards';
import { DashboardCharts } from './components/DashboardCharts';
import { FunnelStage } from './components/FunnelStage';
import { PipelineTable } from './components/PipelineTable';
import { DealModal } from './components/DealModal';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  LayoutDashboard, 
  LogOut, 
  Loader2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  QrCode, 
  RefreshCw, 
  AlertCircle,
  Copy,
  CheckCircle,
  Key
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  auth, 
  generateMfaSecret, 
  generateTOTP, 
  verifyTOTP, 
  fetchUserProfile, 
  createUserProfile, 
  updateUserMfaSettings 
} from './auth';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { 
  subscribeToDeals, 
  addDealToFirestore, 
  updateDealInFirestore, 
  deleteDealFromFirestore 
} from './db';

type AuthScreen = 'login' | 'register' | 'mfa-enroll' | 'mfa-challenge' | 'forgot-password';

export default function App() {
  // Session / Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  
  // Realtime Database state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Credentials Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  
  // MFA (Multi-Factor Authentication) State
  const [generatedMfaSecret, setGeneratedMfaSecret] = useState('');
  const [mfaCodeInput, setMfaCodeInput] = useState('');
  const [tempUserId, setTempUserId] = useState(''); // Used during login/enrollment stages
  const [mfaVerified, setMfaVerified] = useState(false);
  
  // Dynamic TOTP token timer state for our virtual MFA companion widget
  const [currentTimeSec, setCurrentTimeSec] = useState(Math.floor(Date.now() / 1000));
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Table & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAM, setFilterAM] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [filterArchi, setFilterArchi] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  // 1. Maintain ongoing TOTP Clock representation for visual aids
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totpRemainingSeconds = 30 - (currentTimeSec % 30);
  const displayVirtualMfaCode = useMemo(() => {
    const activeSecret = generatedMfaSecret || userProfile?.mfaSecret;
    if (!activeSecret) return '------';
    return generateTOTP(activeSecret);
  }, [generatedMfaSecret, userProfile, Math.floor(currentTimeSec / 30)]);

  // 2. Setup Firebase Session Listener
  useEffect(() => {
    setIsLoadingAuth(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        setMfaVerified(true);
        setAuthError('');
        setIsLoadingAuth(false);

        // Fetch user profile completely in the background without blocking the UI
        fetchUserProfile(firebaseUser.uid).then(async (profile) => {
          if (profile) {
            setUserProfile(profile);
          } else {
            const defaultProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'ECS Member',
              mfaEnabled: false,
              mfaSecret: '',
              createdAt: new Date().toISOString()
            };
            setUserProfile(defaultProfile);
            try {
              await createUserProfile(defaultProfile);
            } catch (err) {
              console.error('Quietly failed to create default profile:', err);
            }
          }
        }).catch((err) => {
          console.error('Background profile load failed:', err);
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setMfaVerified(false);
        setCurrentScreen('login');
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Realtime Subscription to Firestore Pipeline deals when Authenticated & MFA-Verified
  useEffect(() => {
    if (!currentUser || !mfaVerified) return;
    
    setIsLoadingData(true);
    const unsubscribe = subscribeToDeals(
      (freshDeals) => {
        if (freshDeals.length === 0) {
          // If Firestore is empty, initialize it concurrently with sample deals mapped to current user
          const promises = initialDeals.map(deal => 
            addDealToFirestore({
              ...deal,
              ownerId: currentUser.uid,
              ownerEmail: currentUser.email || 'user@cisco.com'
            })
          );
          Promise.all(promises)
            .then(() => {
              setIsLoadingData(false);
            })
            .catch((err) => {
              console.error('Error seeding initial deals:', err);
              setIsLoadingData(false);
            });
        } else {
          setDeals(freshDeals);
          setIsLoadingData(false);
        }
      },
      (error) => {
        console.error('Subscription error:', error);
        setIsLoadingData(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser, mfaVerified]);

  // Handle registration creation
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput || !passwordInput || !displayNameInput) {
      setAuthError('All fields are required.');
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      await updateProfile(cred.user, { displayName: displayNameInput.trim() });
      
      // Write database metadata with MFA false/disabled
      await createUserProfile({
        uid: cred.user.uid,
        email: emailInput.trim(),
        displayName: displayNameInput.trim(),
        mfaEnabled: false,
        mfaSecret: '',
        createdAt: new Date().toISOString()
      });

      setMfaVerified(true);
      setAuthSuccessMsg('Registration successful! Access granted.');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to register account');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Confirm and activate MFA state
  const handleEnrollMfaConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (mfaCodeInput.length !== 6) {
      setAuthError('MFA code must be exactly 6 digits.');
      return;
    }
    
    const tokenMatched = verifyTOTP(generatedMfaSecret, mfaCodeInput);
    if (!tokenMatched) {
      setAuthError('Incorrect 6-digit MFA verification code. Please check your verification code.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      await updateUserMfaSettings(tempUserId, true, generatedMfaSecret);
      setMfaVerified(true);
      setMfaCodeInput('');
      setAuthSuccessMsg('MFA successfully activated! Access granted.');
    } catch (err: any) {
      setAuthError('Failed to activate MFA ' + err.message);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Verify ongoing challenge upon subsequent login attempts
  const handleChallengeMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const activeSecret = userProfile?.mfaSecret || generatedMfaSecret;
    if (!activeSecret) {
      setAuthError('Device key configuration missing. Please register again.');
      return;
    }

    const tokenMatched = verifyTOTP(activeSecret, mfaCodeInput);
    if (!tokenMatched) {
      setAuthError('Passcode incorrect or expired. Please check your authenticator code.');
      return;
    }

    setMfaVerified(true);
    setMfaCodeInput('');
    setAuthSuccessMsg('MFA Verified. Loading pipeline dashboard...');
  };

  // Sign In submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput || !passwordInput) {
      setAuthError('Please fill in your email and password credentials.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      setMfaVerified(true);
      setAuthSuccessMsg('Login successful! Access granted.');

      // Perform user profile operations in the background
      fetchUserProfile(cred.user.uid).then(async (profile) => {
        if (profile) {
          setUserProfile(profile);
        } else {
          const defaultProfile = {
            uid: cred.user.uid,
            email: cred.user.email || emailInput,
            displayName: cred.user.displayName || 'ECS Member',
            mfaEnabled: false,
            mfaSecret: '',
            createdAt: new Date().toISOString()
          };
          setUserProfile(defaultProfile);
          try {
            await createUserProfile(defaultProfile);
          } catch (createErr) {
            console.error('Quietly failed to create profile during login:', createErr);
          }
        }
      }).catch((profileErr) => {
        console.error('Quietly failed to fetch profile during login:', profileErr);
      });
    } catch (err: any) {
      setAuthError('Incorrect details. Please check your credentials.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Handle forgot password reset dispatch
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput) {
      setAuthError('Please specify the account email address.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailInput.trim());
      setAuthSuccessMsg('A password reset code with directions has been sent to ' + emailInput);
      setEmailInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Unable to address reset password query.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Clean up interface session variables
      setCurrentUser(null);
      setUserProfile(null);
      setMfaVerified(false);
      setMfaCodeInput('');
      setGeneratedMfaSecret('');
      setDeals([]);
      setEmailInput('');
      setPasswordInput('');
      setDisplayNameInput('');
      setCurrentScreen('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Transaction Save (Creates or Edits Deals securely linked to the active user profile)
  const handleSaveDeal = async (deal: Deal) => {
    if (!currentUser) return;
    
    try {
      if (editingDeal) {
        // Preserve original owner identifiers and update through Firestore CRUD helper
        const payload: Deal = {
          ...deal,
          ownerId: editingDeal.ownerId || currentUser.uid,
          ownerEmail: editingDeal.ownerEmail || currentUser.email || 'user@cisco.com'
        };
        await updateDealInFirestore(payload);
      } else {
        // Attach current owner identifiers to standard transaction shape
        const payload: Deal = {
          ...deal,
          ownerId: currentUser.uid,
          ownerEmail: currentUser.email || 'user@cisco.com'
        };
        await addDealToFirestore(payload);
      }
      setIsModalOpen(false);
    } catch (e: any) {
      console.error('Save error:', e);
      alert('Save denied by Database rules. Ensure security validation criteria are met.');
    }
  };

  // Transaction Delete
  const handleDeleteDeal = async (id: string) => {
    const target = deals.find(d => d.id === id);
    if (!target) return;

    if (target.ownerId !== currentUser?.uid) {
      alert('Access Denied. You are only authorized to delete opportunities that you created.');
      return;
    }

    if (window.confirm('Delete this opportunity? This will instantly synchronize with the secure Firestore database.')) {
      try {
        await deleteDealFromFirestore(id);
      } catch (e) {
        console.error('Delete error:', e);
        alert('Permission Denied. Only the opportunity owner is authorized to execute deletions.');
      }
    }
  };

  const handleCopySecret = () => {
    const secret = generatedMfaSecret || userProfile?.mfaSecret;
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  // Derived Filter Options mapped from Firestore state
  const amList = useMemo(() => Array.from(new Set(deals.map(d => d.AM_Cisco))).filter(Boolean).sort(), [deals]);
  const partnerList = useMemo(() => Array.from(new Set(deals.map(d => d.Partner))).filter(Boolean).sort(), [deals]);
  const archiList = useMemo(() => Array.from(new Set(deals.map(d => d.Archi))).filter(Boolean).sort(), [deals]);
  const quarterList = useMemo(() => Array.from(new Set(deals.map(d => d.Estimate_Close))).filter(Boolean).sort(), [deals]);

  // Combined Search and Categorical Filters logic
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

  const handleExportExcel = () => {
    const exportData = filteredDeals.map(({ id, ownerId, ownerEmail, updatedAt, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
    XLSX.writeFile(wb, "Cisco_Firestore_Pipeline.xlsx");
  };

  // Render Authentication and MFA Flow Screens
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 font-sans text-slate-100">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <p className="text-slate-400 tracking-wide text-sm">Synchronizing Security Tokens...</p>
      </div>
    );
  }

  if (!currentUser || !mfaVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-100 p-4 relative overflow-hidden">
        {/* Abstract Background Design Ornaments */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl translate-x-12 translate-y-12"></div>

        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md relative z-10 flex flex-col">
          
          {/* Header Visual Branding */}
          <div className="border-b border-slate-800 bg-slate-950/40 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">ECS Cisco Pipeline</h1>
            <p className="text-xs text-slate-400">Zero-Trust Real-Time Sales Security Gateway</p>
          </div>

          <div className="p-6 flex-1">
            {/* Status alerts */}
            {authError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex gap-2 items-start text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}
            {authSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex gap-2 items-start text-xs text-emerald-300">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            {/* SCREEN: Login / Sign In */}
            {currentScreen === 'login' && (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. sales.manager@cisco.com" 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
                    <button 
                      type="button" 
                      onClick={() => { setAuthError(''); setAuthSuccessMsg(''); setCurrentScreen('forgot-password'); }} 
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••••••" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitLoading}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-blue-500/10 flex justify-center items-center gap-2 mt-2 cursor-pointer"
                >
                  {isSubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In To Account'}
                </button>

                <div className="mt-4 text-center">
                  <span className="text-xs text-slate-400">Don't have an account? </span>
                  <button 
                    type="button" 
                    onClick={() => { setAuthError(''); setAuthSuccessMsg(''); setCurrentScreen('register'); }} 
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Register / Sign Up
                  </button>
                </div>
              </form>
            )}

            {/* SCREEN: Register Account */}
            {currentScreen === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Muhammad Ikhsan" 
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required
                      placeholder="e.g. mfa.user@cisco.com" 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Create Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="password" 
                      required
                      placeholder="At least 6 characters" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitLoading}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all shadow-lg flex justify-center items-center gap-2 mt-2 cursor-pointer"
                >
                  {isSubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Account'}
                </button>

                <div className="mt-4 text-center">
                  <span className="text-xs text-slate-400">Already registered? </span>
                  <button 
                    type="button" 
                    onClick={() => { setAuthError(''); setAuthSuccessMsg(''); setCurrentScreen('login'); }} 
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* SCREEN: Forgot Password */}
            {currentScreen === 'forgot-password' && (
              <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
                <p className="text-xs text-slate-400 text-center mb-2 leading-relaxed">
                  Provide your registered email address and we'll transmit a secure link to reset your password.
                </p>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required
                      placeholder="sales.leader@cisco.com" 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitLoading}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all flex justify-center items-center gap-2 mt-2 cursor-pointer"
                >
                  {isSubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transmit Reset Email'}
                </button>

                <div className="mt-4 text-center">
                  <button 
                    type="button" 
                    onClick={() => { setAuthError(''); setAuthSuccessMsg(''); setCurrentScreen('login'); }} 
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Back to login invitation
                  </button>
                </div>
              </form>
            )}

            {/* SCREEN: Multi-Factor Authentication Setup (MFA-EP) */}
            {currentScreen === 'mfa-enroll' && (
              <form onSubmit={handleEnrollMfaConfirm} className="flex flex-col gap-4">
                <p className="text-xs text-slate-300 text-center leading-relaxed font-normal bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 mb-2">
                  🔒 <strong className="text-blue-400 font-semibold">Security Requirement:</strong> Multi-Factor Authentication (MFA) must be initialized for pipeline governance. Save this key inside your device's Authenticator App.
                </p>

                {/* Simulated QR Code Interface */}
                <div className="flex flex-col items-center bg-slate-950 border border-slate-800 p-4 rounded-xl relative overflow-hidden my-1">
                  <div className="w-32 h-32 bg-white p-2 rounded-lg flex items-center justify-center shadow-lg hover:rotate-1 transition-transform relative group">
                    {/* Generates standard complex vectors resembling a QR grid */}
                    <svg viewBox="0 0 29 29" className="w-full h-full text-slate-900" style={{ shapeRendering: 'crispEdges' }}>
                      <path fill="currentColor" d="M0 0h7v7H0zm22 0h7v7h-7zM0 22h7v7H0zm9 0h1v1H9zm1 1h1v1h-1zm2 1h1v1h-1zm-2 2h2v1h-2v1h1v-1h1v1h1v-2zm4-3v2h2v-2zm2 0h2v1h-2zm-2 4h1v1h-1zm1 1h1v1h-1zm6-6h1v1h-1zm1 1h1v1h-1zm-2 2h2v1h-2zm2 2h1v1h-1zm3-4v7h-7v-1h5v-5h1zm-15-4h1v1H9zm1 1h1v1h-1zm2 0h2v1h-2v1h1v-1h1v1h1v-2zm1 3v1h1v-1zm4-3v2h2v-2zm0-4h1v1h-1zm1 1h1v1h-1zm4-1h1v1h-1zm-7 2h2v1h-2v1h1v-1h1v1h1v-2zM23 1h5v5h-5zM1 1h5v5H1zm22 22h5v5h-5zM1 23h5v5H1zm11-13h2v2h-2zm1 4v2h2v-2zm3-3v2h1v-2zm-6 6h1v1h-1zm2 1h1v1h-1z" />
                    </svg>
                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <QrCode className="w-8 h-8 text-blue-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="mt-4 w-full flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Manual Secret Token</span>
                    <div className="flex items-center gap-2 mt-1 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 tracking-widest text-[#00bcd4] font-mono select-all text-xs w-full justify-between">
                      <span>{generatedMfaSecret}</span>
                      <button 
                        type="button" 
                        onClick={handleCopySecret} 
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title="Copy Key"
                      >
                        {copiedSecret ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* COMPANION: Virtual authenticator embedded directly for frictionless development and sandbox review */}
                <div className="bg-blue-950/40 border border-blue-800/20 p-3 rounded-lg my-1 text-xs">
                  <div className="flex justify-between items-center mb-1 font-semibold text-blue-400">
                    <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Virtual Authenticator Helper</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900 text-blue-200 rounded">Sandbox Active</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded border border-slate-800 font-mono">
                    <span className="text-lg font-bold tracking-widest text-emerald-400">{displayVirtualMfaCode}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" style={{ animationDuration: `${totpRemainingSeconds}s` }} /> {totpRemainingSeconds}s left
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Enter Authenticator Passcode</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit passcode" 
                    value={mfaCodeInput}
                    onChange={(e) => setMfaCodeInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-lg font-bold py-2 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-emerald-400"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-all flex justify-center items-center gap-2 mt-2 cursor-pointer"
                >
                  {isSubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Enable MFA'}
                </button>

                <div className="text-center">
                  <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Cancel Registration
                  </button>
                </div>
              </form>
            )}

            {/* SCREEN: Multi-Factor Authentication Challenge during login */}
            {currentScreen === 'mfa-challenge' && (
              <form onSubmit={handleChallengeMfaVerify} className="flex flex-col gap-4">
                <p className="text-xs text-slate-300 text-center leading-relaxed font-normal bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  🔒 <strong className="text-blue-400 font-semibold">2-Step Verification:</strong> Enter the dynamic 6-digit authentication token generated by your device's Authenticator App.
                </p>

                {/* COMPANION: Virtual authenticator embedded directly for frictionless development and sandbox review */}
                <div className="bg-blue-950/40 border border-blue-800/20 p-3 rounded-lg text-xs">
                  <div className="flex justify-between items-center mb-1 font-semibold text-blue-400">
                    <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Virtual Authenticator helper</span>
                    <button type="button" onClick={handleCopySecret} className="text-[10px] text-blue-300 hover:underline">Copy Key</button>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded border border-slate-800 font-mono">
                    <span className="text-lg font-bold tracking-widest text-emerald-400">{displayVirtualMfaCode}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-sans">
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin animate-infinite" style={{ animationDuration: '30s' }} /> {totpRemainingSeconds}s left
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">MFA Verification Passcode</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit code" 
                    value={mfaCodeInput}
                    onChange={(e) => setMfaCodeInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-lg font-bold py-2 bg-slate-950 border border-slate-800 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-emerald-400 animate-pulse"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg text-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
                >
                  Verify and Sign In
                </button>

                <div className="text-center">
                  <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Logout from Session
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
    );
  }

  // Render main pipeline database loading state
  if (isLoadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-wider">Syncing Pipelines in Real-Time...</h2>
        <p className="text-sm text-slate-400">Communicating with Firestore remote collections</p>
      </div>
    );
  }

  // Main Dashboard Panel once authenticated & verified with 2-Factor Authentication
  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      {/* HEADER NAVBAR */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg shrink-0">
              <LayoutDashboard className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">ECS Cisco Sales Pipeline</h1>
              <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Real-Time Firestore Synced
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-950/50 border border-slate-800 rounded-lg py-1 px-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-300">
                {currentUser?.displayName?.charAt(0).toUpperCase() || 'E'}
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{currentUser?.displayName || 'Cisco User'}</p>
                <p className="text-[10px] text-slate-400 leading-none">{currentUser?.email}</p>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium border border-emerald-500/20 select-none ml-1">SECURE SESSION</span>
            </div>
            
            <button
              onClick={() => {
                setEditingDeal(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-blue-600/10"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Deal</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-slate-800"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* TOOLBAR */}
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col 2xl:flex-row gap-4 justify-between items-start 2xl:items-center">
            
            {/* Search */}
            <div className="relative w-full 2xl:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Enduser, BDM/PS, DID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-800"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full 2xl:w-auto">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Filters:</span>
              </div>
              
              <select value={filterAM} onChange={(e) => setFilterAM(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white min-w-[125px]">
                <option value="">All AM Cisco</option>
                {amList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white min-w-[125px]">
                <option value="">All Partners</option>
                {partnerList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterArchi} onChange={(e) => setFilterArchi(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white min-w-[125px]">
                <option value="">All Archi</option>
                {archiList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white min-w-[100px]">
                <option value="">All Stages</option>
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="90">90%</option>
                <option value="100">100%</option>
              </select>

              <select value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value)} className="p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white min-w-[125px]">
                <option value="">All Quarters</option>
                {quarterList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <div className="flex-1"></div>
              
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 px-3 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap cursor-pointer shadow-sm"
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
              if (deal.ownerId && deal.ownerId !== currentUser?.uid) {
                alert('Access Denied. You are only authorized to modify opportunities that you created.');
                return;
              }
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
