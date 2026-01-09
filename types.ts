
// --- Enums & Basic Types ---
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export type ThemeType = 'default' | 'cyberpunk' | 'ocean' | 'sunset';
export type LayoutMode = 'default' | 'minimal' | 'advanced';
export type FpsLevel = 'low' | 'medium' | 'high';
export type AIProvider = 'gemini' | 'openai'; 

// --- Domain Entities ---
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
}

// BETA: Recurring Transaction Entity
export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  dayOfMonth: number; // 1-31
  active: boolean;
}

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO string YYYY-MM-DD
  isAI: boolean; 
  isCompleted: boolean;
  createdAt?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  createdAt?: number;
  lastLogin?: number;
  isAdministrator?: boolean; // Admin Role Flag
  badges?: string[]; // Badges adquiridas (ex: 'supporter')
  storeBalance?: number; // Saldo na loja
}

export interface UserStats {
  hasUsedAI?: boolean;
  aiUsageCount?: number; // Contador para conquistas de veterano em IA
  totalTransactions?: number;
  lastAnalysisDate?: number;
  // NEW GAMIFICATION STATS
  hasSimulatedFuture?: boolean;
  hasUsedCalendar?: boolean;
  loginDevice?: 'mobile' | 'desktop' | 'tablet';
  completedGoalsCount?: number; // Metas alcançadas
  customCategoriesCount?: number; // Categorias criadas
  highValueIncomeCount?: number; // Receitas > R$ 10k
}

export type AchievementCondition = 'transaction_count' | 'income_count' | 'expense_count' | 'total_balance' | 'manual' | 'ai_usage';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  // Dynamic fields
  iconUrl?: string; // Base64 image from AI
  iconName?: 'FirstIncome' | 'FirstExpense' | 'FirstAI' | 'DataMaster' | 'Saver' | 'BetaTester' | 'FutureVision' | 'MobileUser' | 'PCUser' | 'TimeTraveler' | 'CareerFocus' | 'FinanceMaster' | 'Custom' | 'Medal' | 'Target' | 'Award' | 'BrainCircuit' | 'User' | 'Crown';
  conditionType?: AchievementCondition;
  conditionValue?: number;
  // State
  isUnlocked: boolean;
  unlockedAt?: string;
  progress?: number; // 0 to 100
  isSystem?: boolean; // If true, cannot be deleted by admin easily
}

// --- System Types ---
export interface SystemConfig {
  maintenanceMode: boolean;
  lastUpdated: number;
  updatedBy: string;
  activePatchVersion?: string;
  forceGlobalBeta?: boolean; // NEW: Admin override
}

export interface AIConfig {
  activeProvider: AIProvider;
  lastChanged: number;
  changedBy: string;
}

export interface IntegrityLog {
  id: string;
  timestamp: number;
  step: string;
  status: 'ok' | 'warning' | 'error';
  details: string;
  aiAnalysis?: string;
  provider?: AIProvider; // Logar qual IA fez a análise
}

export interface IntegrityState {
  checkCount: number; // 0 to 6
  isPaused: boolean;
  lastCheckTime: number;
  forceCheckTrigger: number; // Timestamp to trigger forced check
  newUserTrigger: number; // Timestamp when a new user registered
  status: 'idle' | 'running' | 'paused' | 'error';
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokensProcessed: number;
  lastRequestTime: number;
  activeServices: boolean;
}

// --- AI Types ---
export interface AIAnalysisResult {
  summary: string;
  savingsTip: string;
  alert: string | null;
  prediction: string;
  cashFlowTip?: string; 
  // Novos campos para box expandido
  investmentTip?: string;
  spendingHabit?: string;
  providerUsed?: AIProvider; // Para exibir na UI qual IA foi usada
  suggestedGoals?: { title: string; targetAmount: number; deadline: string }[];
  analyzedAt?: number;
  // BETA: Future Projection
  futureProjections?: { month: string; projectedBalance: number; note: string }[];
}

export interface FinancialScoreResult {
  score: number; // 0 to 1000
  rating: 'Crítico' | 'Baixo' | 'Regular' | 'Bom' | 'Excelente';
  analysis: string;
  factors: { name: string; impact: 'positive' | 'negative' | 'neutral' }[];
  providerUsed?: AIProvider;
}

// --- Configuration Types ---
export interface AppSettings {
  performance: {
    fps: FpsLevel;
    highPerformanceMode: boolean;
  };
  visual: {
    theme: ThemeType;
    layoutMode: LayoutMode;
    scale: number; // 0.8 a 1.2
    showHeaderBetaSwitch?: boolean; // NEW: Controls visibility of Beta toggle in header
  };
  account: {
    autoLogin: boolean;
    notificationsEnabled?: boolean;
    betaMode?: boolean; // NEW: User toggle
  };
}

// --- UI State Types ---
export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number; // Percentage
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface LoadingState {
  auth: boolean;
  data: boolean;
  ai: boolean;
  action: boolean; // For button loading states
}

// --- Global Extensions ---
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
