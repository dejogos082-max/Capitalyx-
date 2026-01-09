
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { onAuthStateChanged, ConfirmationResult } from 'firebase/auth';
import { 
  auth, 
  loginWithGoogle, 
  loginWithGithub, 
  addTransaction as firebaseAddTx, 
  deleteTransaction as firebaseDeleteTx, 
  subscribeToTransactions,
  registerWithEmail,
  loginWithEmail,
  resetPassword,
  loginWithPhone,
  setupRecaptcha,
  subscribeToStats,
  addGoal as firebaseAddGoal,
  updateGoal as firebaseUpdateGoal,
  deleteGoal as firebaseDeleteGoal,
  subscribeToGoals,
  markAIUsage,
  verifyLoginCode,
  getUserProfileData,
  subscribeToUserProfile,
  subscribeToSystemStatus,
  validateAdminIntegrity,
  logout as firebaseLogout,
  saveUserProfileToDB,
  addRecurringTransaction,
  subscribeToRecurringTransactions,
  addCustomCategory,
  subscribeToCustomCategories,
  updateUserStats,
  subscribeToAchievements,
  subscribeToUserAchievements,
  unlockUserAchievement,
  restoreDefaultAchievements
} from './services/firebase';
import { mapAuthErrorToMessage } from './services/authOptimized';
import { 
  UserProfile, Transaction, TransactionType, Achievement, UserStats, 
  FinancialGoal, AIAnalysisResult, AppSettings, ToastMessage, RecurringTransaction
} from './types';
import { generateFinancialInsights } from './services/geminiService';
import { 
  TrendingUp, Github, Chrome, Plus, AlertTriangle, 
  Mail, Lock, Smartphone, ArrowRight, ArrowLeft, X, Target,
  KeyRound, Clock, WifiOff, Construction, CheckSquare, Square, Briefcase, User as UserIcon, Phone,
  Loader2, CheckCircle, Globe
} from 'lucide-react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';

// Import Components
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import AIInsights from './components/AIInsights';
import Achievements from './components/Achievements';
import Goals from './components/Goals';
import Settings from './components/Settings';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import SystemMonitor from './components/SystemMonitor';

// --- Static Texts ---
const BASE_STRINGS = {
  welcome: "Bem-vindo ao Capitalyx",
  welcome_subtitle: "Gestão financeira moderna impulsionada por IA",
  login: "Entrar",
  register: "Cadastrar",
  email: "E-mail",
  password: "Senha",
  name: "Nome Completo",
  phone: "Telefone",
  remember_me: "Lembrar de mim",
  forgot_pass: "Esqueceu a senha?",
  or_login_with: "Ou entre com",
  error_pass_mismatch: "As senhas não coincidem.",
  loading_app: "Carregando Capitalyx...",
  maintenance_title: "Modo Manutenção",
  maintenance_desc: "O sistema está passando por melhorias críticas.",
  success_login: "Login realizado com sucesso!",
  success_register: "Conta criada! Verifique seu e-mail.",
  menu_dashboard: "Visão Geral",
  menu_transactions: "Transações",
  menu_goals: "Metas",
  menu_insights: "Insights AI",
  menu_achievements: "Conquistas",
  menu_profile: "Perfil",
  menu_settings: "Configurações",
  menu_admin: "Admin",
  logout: "Sair"
};

const DEFAULT_SETTINGS: AppSettings = {
  performance: { fps: 'low', highPerformanceMode: false },
  visual: { theme: 'default', layoutMode: 'default', scale: 1.0, showHeaderBetaSwitch: false },
  account: { autoLogin: true, betaMode: false }
};

type AuthMode = 'login' | 'register' | 'forgot-pass' | 'phone' | 'phone-otp' | 'login-code';

const MaintenanceScreen = () => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
    <Construction size={64} className="text-yellow-500 mb-4" />
    <h1 className="text-2xl font-bold text-white mb-2">Sistema em Manutenção</h1>
    <p className="text-slate-400">Voltaremos em breve com novidades.</p>
  </div>
);

const useToast = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => { setToast(current => current?.id === id ? null : current); }, 5000);
  }, []);
  const closeToast = useCallback(() => setToast(null), []);
  return { toast, showToast, closeToast };
};

const useAuthSystem = (showToast: (msg: string, type: any) => void) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [confirmObj, setConfirmObj] = useState<ConfirmationResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const isProfileLoaded = useRef(false);
  const loginTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    let profileUnsubscribe: () => void = () => {};
    
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      profileUnsubscribe();

      if (firebaseUser) {
        loginTimeRef.current = Date.now();
        
        const basicUser: UserProfile = { 
            uid: firebaseUser.uid, 
            displayName: firebaseUser.displayName || 'Usuário', 
            email: firebaseUser.email, 
            photoURL: firebaseUser.photoURL, 
            emailVerified: firebaseUser.emailVerified, 
            isAdministrator: false 
        };

        setUser(prev => {
            if (prev?.uid === firebaseUser.uid) return prev;
            return basicUser;
        });

        setLoading(false);

        profileUnsubscribe = subscribeToUserProfile(firebaseUser.uid, (dbProfile) => {
            if (dbProfile) {
                // FIX: Sanitização de arrays que podem vir como objetos do Firebase
                const safeBadges = Array.isArray(dbProfile.badges) 
                    ? dbProfile.badges 
                    : (dbProfile.badges ? Object.values(dbProfile.badges) : []);

                setUser(prev => ({ 
                    ...prev, 
                    ...dbProfile, 
                    badges: safeBadges, // Garante que é array
                    uid: firebaseUser.uid, 
                    email: firebaseUser.email, 
                    emailVerified: firebaseUser.emailVerified,
                    isAdministrator: dbProfile.isAdministrator || false 
                }));
            } else if (!isProfileLoaded.current) {
                const newProfile: UserProfile = { 
                    uid: firebaseUser.uid, 
                    displayName: firebaseUser.displayName || 'Usuário', 
                    email: firebaseUser.email, 
                    photoURL: firebaseUser.photoURL, 
                    emailVerified: firebaseUser.emailVerified, 
                    isAdministrator: false 
                };
                setUser(prev => ({ ...prev, ...newProfile }));
                saveUserProfileToDB(firebaseUser);
            }
            isProfileLoaded.current = true;
        });
      } else {
        setUser(null); 
        isProfileLoaded.current = false; 
        loginTimeRef.current = 0; 
        setLoading(false);
      }
    });
    return () => { authUnsubscribe(); profileUnsubscribe(); };
  }, []);

  const handleAuthError = useCallback((error: any) => {
    setProcessing(false);
    const friendlyMessage = mapAuthErrorToMessage(error);
    setError(friendlyMessage);
    showToast(friendlyMessage, 'error');
  }, [showToast]);

  const loginSocial = useCallback(async (provider: 'google' | 'github') => {
    setProcessing(true); setLoading(true);
    try { if(provider === 'google') await loginWithGoogle(); else await loginWithGithub(); } 
    catch (e) { handleAuthError(e); setLoading(false); }
  }, [handleAuthError]);

  const loginEmailAction = useCallback(async (email: string, pass: string) => {
    setProcessing(true); setError(null);
    try { 
        await loginWithEmail(email, pass); 
    } catch (e: any) { 
        handleAuthError(e); 
    } finally { setProcessing(false); }
  }, [handleAuthError, showToast]);

  const performLogout = useCallback(async () => {
    if (Date.now() - loginTimeRef.current < 5000) return;
    setLoading(true); await firebaseLogout(); setUser(null); setLoading(false);
  }, []);

  const registerEmailAction = useCallback(async (email: string, pass: string, profileData: any) => {
    setProcessing(true); setError(null);
    try { await registerWithEmail(email, pass, profileData); showToast("Conta criada! Verifique seu e-mail.", 'success'); setAuthMode('login'); } 
    catch (e) { handleAuthError(e); } finally { setProcessing(false); }
  }, [handleAuthError, showToast]);

  return { user, loading, authMode, setAuthMode, error, setError, processing, loginSocial, loginEmail: loginEmailAction, registerEmail: registerEmailAction, performLogout, setUser };
};

const useFinancialData = (user: UserProfile | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [stats, setStats] = useState<UserStats>({});
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [globalAchievements, setGlobalAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user && user.uid) {
      const unsubTx = subscribeToTransactions(user.uid, setTransactions);
      const unsubGoals = subscribeToGoals(user.uid, setGoals);
      const unsubStats = subscribeToStats(user.uid, setStats);
      const unsubRecurring = subscribeToRecurringTransactions(user.uid, setRecurringTransactions);
      const unsubCats = subscribeToCustomCategories(user.uid, setCustomCategories);
      const unsubGlobalAch = subscribeToAchievements(setGlobalAchievements);
      const unsubUserAch = subscribeToUserAchievements(user.uid, setUserAchievements);
      return () => { unsubTx(); unsubGoals(); unsubStats(); unsubRecurring(); unsubCats(); unsubGlobalAch(); unsubUserAch(); };
    }
  }, [user?.uid]);

  const mergedAchievements = useMemo(() => {
    return globalAchievements.map(ach => ({
        ...ach,
        isUnlocked: userAchievements[ach.id]?.isUnlocked || false,
        unlockedAt: userAchievements[ach.id]?.unlockedAt,
        progress: userAchievements[ach.id]?.progress || 0
    }));
  }, [globalAchievements, userAchievements]);

  return { transactions, goals, stats, recurringTransactions, customCategories, achievements: mergedAchievements, rawGlobalAchievements: globalAchievements };
};

function App() {
  const { toast, showToast, closeToast } = useToast();
  const { user, loading: authLoading, authMode, setAuthMode, error: authError, setError, processing, loginSocial, loginEmail, registerEmail, performLogout, setUser } = useAuthSystem(showToast);
  const { transactions, goals, stats: userStats, recurringTransactions, customCategories, achievements, rawGlobalAchievements } = useFinancialData(user);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiInsight, setAiInsight] = useState<AIAnalysisResult | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFormDate, setSelectedFormDate] = useState<string | undefined>(undefined);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [newGoalData, setNewGoalData] = useState({ title: '', amount: '', date: '' });
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [forceGlobalBeta, setForceGlobalBeta] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try { const saved = localStorage.getItem('capitalyx_settings'); return saved ? JSON.parse(saved) : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
  });
  
  const i18n = BASE_STRINGS;

  useEffect(() => {
    localStorage.setItem('capitalyx_settings', JSON.stringify(settings));
  }, [settings]);

  const isBetaModeActive = settings.account.betaMode || forceGlobalBeta;

  useEffect(() => {
      const unsub = subscribeToSystemStatus((config) => {
          setIsMaintenance(config.maintenanceMode);
          if (config.forceGlobalBeta !== undefined) { setForceGlobalBeta(config.forceGlobalBeta); }
      });
      return () => unsub();
  }, []);

  const isRestoringRef = useRef(false);

  // --- ACHIEVEMENT ENGINE & AUTO-RESTORE ---
  useEffect(() => {
      if (!user) return;

      if (!isRestoringRef.current && rawGlobalAchievements.length > 0 && rawGlobalAchievements.length !== 5) {
          console.log("Restaurando conquistas padrão...");
          isRestoringRef.current = true;
          restoreDefaultAchievements().finally(() => {
              setTimeout(() => { isRestoringRef.current = false; }, 2000);
          });
      }

      if (achievements.length === 0) return;

      const runEngine = async () => {
          const incomeCount = transactions.filter(t => t.type === TransactionType.INCOME).length;
          const expenseCount = transactions.filter(t => t.type === TransactionType.EXPENSE).length;
          const hasSalary = transactions.some(t => t.category === 'Salário' || t.description.toLowerCase().includes('salário'));
          const hasUsedBeta = userStats.hasSimulatedFuture || userStats.hasUsedCalendar;
          const hasUsedAI = (userStats.aiUsageCount || 0) > 0;

          for (const ach of achievements) {
              // Se já está desbloqueada, pula
              if (ach.isUnlocked) continue;

              let currentProgress = 0;
              
              if (ach.title === "Mestre das Receitas") currentProgress = (incomeCount / 5) * 100;
              else if (ach.title === "Controlador de Gastos") currentProgress = (expenseCount / 5) * 100;
              else if (ach.title === "Trabalhador Honesto") currentProgress = hasSalary ? 100 : 0;
              else if (ach.title === "Explorador Beta") currentProgress = hasUsedBeta ? 100 : 0;
              else if (ach.title === "Capitalyx AI") currentProgress = hasUsedAI ? 100 : 0;

              if (currentProgress >= 100) {
                  // 1. Desbloqueia conquista
                  await unlockUserAchievement(user.uid, ach.id, 100);
                  
                  showToast(`Conquista desbloqueada: ${ach.title}`, 'success');
              }
          }
      };

      const timer = setTimeout(runEngine, 3000);
      return () => clearTimeout(timer);
  }, [transactions, userStats, achievements, user?.uid, rawGlobalAchievements.length]);

  const handleAuthFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (authMode === 'login') { loginEmail(email.trim(), password); } 
      else if (authMode === 'register') {
          if (password !== confirmPassword) { setError(i18n.error_pass_mismatch); return; }
          registerEmail(email.trim(), password, { jobTitle: occupation, displayName: fullName, phoneNumber: phoneNumber });
      }
  };

  const addTx = useCallback((transaction: Omit<Transaction, 'id'>) => {
    if (user) firebaseAddTx(user.uid, transaction);
  }, [user]);

  const removeTx = useCallback((id: string) => {
    if (user) firebaseDeleteTx(user.uid, id);
  }, [user]);

  const addRecurring = useCallback((item: Omit<RecurringTransaction, 'id'>) => {
    if (user) addRecurringTransaction(user.uid, item);
  }, [user]);

  const addCategory = useCallback((cat: string) => {
    if (user) addCustomCategory(user.uid, cat);
  }, [user]);

  const addGoal = useCallback((goal: Omit<FinancialGoal, 'id'>) => {
    if (user) firebaseAddGoal(user.uid, goal);
  }, [user]);

  const updateGoal = useCallback((id: string, updates: Partial<FinancialGoal>) => {
    if (user) firebaseUpdateGoal(user.uid, id, updates);
  }, [user]);

  const removeGoal = useCallback((id: string) => {
    if (user) firebaseDeleteGoal(user.uid, id);
  }, [user]);

  const handleGenerateAI = useCallback(async () => {
    if(user && (transactions.length > 0 || recurringTransactions.length > 0)) {
        try {
            const result = await generateFinancialInsights(transactions, goals);
            setAiInsight(result);
            markAIUsage(user.uid);
        } catch(e) { console.error("AI Gen failed", e); }
    }
  }, [user, transactions, goals]);

  const handleGoalSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if(newGoalData.title && newGoalData.amount && newGoalData.date) {
        addGoal({ title: newGoalData.title, targetAmount: parseFloat(newGoalData.amount), currentAmount: 0, deadline: newGoalData.date, isAI: false, isCompleted: false });
        setIsGoalFormOpen(false);
        setNewGoalData({ title: '', amount: '', date: '' });
        showToast("Meta criada!", 'success');
    }
  }, [newGoalData, addGoal, showToast]);

  const handleTransactionSubmit = (data: any) => {
      if (data.isRecurring) {
          addRecurring(data);
          showToast("Recorrente agendada!", 'success');
      } else {
          const { isRecurring, dayOfMonth, ...txData } = data;
          addTx(txData);
          showToast("Transação salva!", 'success');
      }
  };

  const motionConfig = useMemo(() => ({ transition: { type: "spring", stiffness: 100, damping: 20 } }), []);

  const AuthLoader = () => (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md">
      <Loader2 className="w-4 h-4 text-primary animate-spin" />
      <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Iniciando Capitalyx...</span>
    </div>
  );

  if (isMaintenance && user && !user.isAdministrator) {
      return <MaintenanceScreen />; 
  }

  if (authLoading && !user) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin opacity-20 mb-4" />
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">Autenticando...</span>
        </div>
      );
  }

  if (!user) {
    return (
      <MotionConfig transition={motionConfig.transition}>
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
          <div className="z-10 w-full max-w-md">
            <div className="flex flex-col items-center mb-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="p-4 bg-gradient-to-tr from-primary to-secondary rounded-2xl shadow-2xl mb-4">
                <TrendingUp size={40} className="text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{i18n.welcome}</h1>
              <p className="text-slate-400 text-sm">{i18n.welcome_subtitle}</p>
            </div>

            <div className="bg-surface p-8 rounded-2xl border border-slate-700 shadow-2xl relative">
              {authError && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <p>{authError}</p>
                  </motion.div>
              )}

              <div className="flex justify-between mb-6 bg-slate-900 p-1 rounded-xl">
                <button onClick={() => { setAuthMode('login'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'login' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400'}`}>{i18n.login}</button>
                <button onClick={() => { setAuthMode('register'); setError(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'register' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400'}`}>{i18n.register}</button>
              </div>

              <form onSubmit={handleAuthFormSubmit} className="space-y-4">
                {authMode === 'register' && (
                    <>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase ml-1">{i18n.name}</label>
                        <div className="relative"><UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} /><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 text-white focus:ring-2 focus:ring-primary outline-none" required /></div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase ml-1">{i18n.phone}</label>
                        <div className="relative"><Phone className="absolute left-3 top-3.5 text-slate-500" size={18} /><input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 text-white focus:ring-2 focus:ring-primary outline-none" required /></div>
                    </div>
                    </>
                )}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 uppercase ml-1">{i18n.email}</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 text-white focus:ring-2 focus:ring-primary outline-none" placeholder="seu@email.com" required />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 uppercase ml-1">{i18n.password}</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 text-white focus:ring-2 focus:ring-primary outline-none" placeholder="******" required />
                    </div>
                </div>
                {authMode === 'register' && (
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase ml-1">Confirmar</label>
                        <div className="relative"><Lock className="absolute left-3 top-3.5 text-slate-500" size={18} /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 text-white focus:ring-2 focus:ring-primary outline-none" required /></div>
                    </div>
                )}
                
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded bg-slate-800" /><span className="text-xs text-slate-400">{i18n.remember_me}</span></label>
                    {authMode === 'login' && <button type="button" className="text-xs text-primary font-medium">{i18n.forgot_pass}</button>}
                </div>

                <button type="submit" disabled={processing} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-70">
                  {processing ? <Loader2 className="animate-spin" size={20}/> : (authMode === 'login' ? i18n.login : i18n.register)}
                </button>
              </form>
              <div className="relative py-4 text-center">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-500">{i18n.or_login_with}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => loginSocial('google')} className="bg-slate-700 hover:bg-slate-600 p-3 rounded-xl flex justify-center transition-colors border border-slate-600"><Chrome size={20} /></button>
                <button onClick={() => loginSocial('github')} className="bg-slate-700 hover:bg-slate-600 p-3 rounded-xl flex justify-center transition-colors border border-slate-600"><Github size={20} /></button>
              </div>
            </div>
          </div>
        </div>
        {toast && <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-[100] border ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}><CheckCircle size={20}/> {toast.message}</div>}
      </MotionConfig>
    );
  }

  return (
    <MotionConfig transition={motionConfig.transition}>
      {authLoading && <AuthLoader />}
      <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab} settings={settings} onLogout={performLogout} onUpdateSettings={setSettings}>
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && <Settings user={user} settings={settings} onUpdateSettings={setSettings} onShowToast={(msg) => showToast(msg, 'info')} />}
          {activeTab === 'dashboard' && (
            <Dashboard 
                transactions={transactions} 
                aiInsight={aiInsight} 
                onGenerateAI={handleGenerateAI} 
                goals={goals} 
                isBetaMode={isBetaModeActive} 
                recurringTransactions={recurringTransactions}
                onOpenTransactionForm={() => { setSelectedFormDate(undefined); setIsFormOpen(true); }}
                onAddTransactionOnDate={(d) => { setSelectedFormDate(d); setIsFormOpen(true); }}
                onUpdateStats={updateUserStats}
                setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'transactions' && <TransactionList transactions={transactions} onDelete={removeTx} onAdd={() => setIsFormOpen(true)} />}
          {activeTab === 'goals' && <Goals goals={goals} onAddGoal={addGoal} onUpdateGoal={updateGoal} onDeleteGoal={removeGoal} suggestions={aiInsight?.suggestedGoals} />}
          {activeTab === 'analytics' && <AIInsights transactions={transactions} goals={goals} />}
          {activeTab === 'achievements' && <Achievements achievements={achievements} />}
          {activeTab === 'profile' && <Profile user={user} transactions={transactions} onUpdateUser={setUser} onShowToast={(msg) => showToast(msg, 'success')} onLogout={performLogout} />}
          {activeTab === 'admin' && user.isAdministrator && <AdminPanel user={user} />}
        </AnimatePresence>

        <AnimatePresence>
          {isFormOpen && (
            <TransactionForm 
                isOpen={isFormOpen} 
                onClose={() => setIsFormOpen(false)} 
                onSubmit={handleTransactionSubmit} 
                isBetaMode={isBetaModeActive} 
                customCategories={customCategories} 
                onAddCustomCategory={addCategory} 
                initialDate={selectedFormDate} 
            />
          )}
          {isGoalFormOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div className="bg-surface w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Nova Meta</h2>
                        <button onClick={() => setIsGoalFormOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
                    </div>
                    <form onSubmit={handleGoalSubmit} className="space-y-4">
                        <input type="text" required value={newGoalData.title} onChange={e => setNewGoalData({...newGoalData, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Ex: Viagem" />
                        <input type="number" required value={newGoalData.amount} onChange={e => setNewGoalData({...newGoalData, amount: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" placeholder="Valor" />
                        <input type="date" required value={newGoalData.date} onChange={e => setNewGoalData({...newGoalData, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                        <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">Criar Meta</button>
                    </form>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
      <SystemMonitor user={user} />
      {toast && <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl flex items-center gap-3 z-[100] border ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}><CheckCircle size={20}/> {toast.message}</div>}
    </MotionConfig>
  );
}

export default App;
