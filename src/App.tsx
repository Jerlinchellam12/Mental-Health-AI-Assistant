import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  where,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { getChatResponse, extractTheme, getParentSuggestions } from './services/geminiService';
import { 
  Heart, 
  Send, 
  LogOut, 
  User as UserIcon, 
  MessageCircle, 
  Shield, 
  ArrowRight,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
  Info,
  Mic,
  Volume2,
  VolumeX,
  Loader2
} from 'lucide-react';
import { transcribeAudio, createAudioRecorder } from './services/voiceService';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { Avatar, updateAvatarMood } from './components/Avatar';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'teen' | 'parent';
  createdAt: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  isHearted?: boolean;
  theme?: string;
}

interface ParentTheme {
  id: string;
  parentId: string;
  childId: string;
  theme: string;
  lastUpdated: string;
}

// --- Components ---

const LighthouseIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Beacon Glow (Pulsing) */}
    <motion.circle 
      cx="12" cy="7.5" r="5" 
      fill="currentColor" 
      initial={{ opacity: 0.1 }}
      animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.3, 1] }}
      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      stroke="none"
    />
    
    {/* The Light Source */}
    <circle cx="12" cy="7.5" r="2" fill="currentColor" />

    {/* Rounded Dome Top */}
    <path d="M8 5.5C8 2.5 16 2.5 16 5.5" fill="currentColor" stroke="none" />
    <path d="M8 5.5h8" />

    {/* Lantern Room (Rounded Glass area) */}
    <rect x="9" y="5.5" width="6" height="4" rx="3" />
    
    {/* Gallery / Balcony */}
    <path d="M7.5 9.5h9" strokeWidth="2" />

    {/* Main Tower Body (Tapered and Curved) */}
    <path d="M9.5 9.5C9 13 8.5 17 8.5 20h7c0-3-0.5-7-1-10.5h-5z" />
    
    {/* Tower Stripes for clarity */}
    <path d="M9 13.5h6" strokeWidth="1" opacity="0.5" />
    <path d="M8.7 17h6.6" strokeWidth="1" opacity="0.5" />

    {/* Base Foundation */}
    <path d="M7 20h10" strokeWidth="2" />
    <path d="M6 22h12" />
  </svg>
);

const WavesIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <motion.path 
      d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" 
      animate={{ x: [-1, 1, -1] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
    />
    <motion.path 
      d="M2 16c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" 
      animate={{ x: [1, -1, 1] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.5 }}
    />
    <motion.path 
      d="M2 8c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" 
      animate={{ x: [0.5, -0.5, 0.5] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 }}
    />
  </svg>
);

const AnchorIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <motion.g
      animate={{ rotate: [-2, 2, -2] }}
      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      style={{ originX: '12px', originY: '4px' }}
    >
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v10" />
      <path d="M8 12h8" />
      <path d="M12 17c-3 0-6-2-6-6" />
      <path d="M12 17c3 0 6-2 6-6" />
      <path d="M5 11l1 1" />
      <path d="M19 11l-1 1" />
    </motion.g>
  </svg>
);

const Logo = ({ className, size = "md" }: { className?: string, size?: "sm" | "md" | "lg" | "xl" }) => {
  const sizes = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
    xl: "text-8xl"
  };
  
  return (
    <h1 className={cn("font-bold font-logo tracking-normal leading-tight", sizes[size], className)}>
      <span className="text-brand-blue">lumin</span>
      <span className="text-brand-yellow">&</span>
      <span className="text-brand-blue">us®</span>
    </h1>
  );
};

const Disclaimer = ({ onAccept }: { onAccept: () => void }) => (
  <div className="fixed inset-0 bg-brand-navy/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-brand-paper rounded-[40px] p-10 max-w-lg w-full shadow-2xl border border-white/20"
    >
      <div className="flex items-center gap-3 mb-6 text-[#2B3964]">
        <Shield className="w-8 h-8" />
        <h2 className="text-2xl font-bold font-sans tracking-tight">Welcome to lumin&us®</h2>
      </div>
      <p className="text-[#2B3964] mb-6 leading-relaxed serif-content">
        lumin&us® is a wellbeing support tool designed to help young people feel heard and help families connect. 
        One of our key aims is to suggest small, meaningful activities and actions that parents can do to support their teen's wellbeing.
        It is <span className="font-semibold">not a clinical service</span> and is not a substitute for professional mental health support.
      </p>
      <div className="bg-brand-blue/10 rounded-2xl p-4 mb-8 border border-brand-blue/20">
        <p className="text-sm text-[#2B3964] font-medium">
          If you or someone you know is in crisis, please contact Childline (0800 1111) or your GP immediately.
        </p>
      </div>
      <button 
        onClick={onAccept}
        className="w-full bg-brand-navy text-brand-paper py-4 rounded-2xl font-semibold hover:bg-brand-navy/90 transition-colors flex items-center justify-center gap-2 group shadow-lg"
      >
        I understand and agree
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  </div>
);

const SafetyCode = ({ role, onVerify, onCancel }: { role: 'teen' | 'parent', onVerify: (code: string) => void, onCancel: () => void }) => {
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError(false);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit if all digits are filled
    if (value && index === 3) {
      const fullCode = newCode.join('');
      const correctCode = role === 'parent' ? '1234' : '0000';
      if (fullCode === correctCode) {
        setIsVerifying(true);
        setTimeout(() => onVerify(fullCode), 300);
      } else {
        setError(true);
        setCode(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const fullCode = code.join('');
    if (fullCode.length === 4) {
      const correctCode = role === 'parent' ? '1234' : '0000';
      if (fullCode === correctCode) {
        setIsVerifying(true);
        setTimeout(() => onVerify(fullCode), 300);
      } else {
        setError(true);
        setCode(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-navy z-[60] flex flex-col items-center justify-center p-6">
      <div className="atmosphere" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-sm w-full"
      >
        <div className={cn(
          "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl transition-all duration-300",
          isVerifying ? "scale-110 bg-green-500 text-white" : (role === 'parent' ? "bg-brand-yellow text-brand-navy" : "bg-brand-blue text-brand-navy")
        )}>
          {isVerifying ? <Check className="w-10 h-10" /> : (role === 'parent' ? <Heart className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />)}
        </div>
        <h2 className="text-3xl font-bold text-brand-paper mb-2 font-sans tracking-tight">
          {isVerifying ? "Code Verified" : "Enter Safety Code"}
        </h2>
        <p className="text-brand-paper/40 mb-10 serif-content">
          {isVerifying ? "Opening profile..." : (role === 'parent' ? "Enter parent PIN (Try 1234)" : "Enter teen PIN (Try 0000)")}
        </p>

        <div className="flex justify-center gap-4 mb-8">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              value={digit}
              disabled={isVerifying}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={cn(
                "w-14 h-20 bg-white/5 border-2 rounded-2xl text-center text-3xl font-bold text-brand-paper focus:outline-none transition-all",
                error ? "border-red-500/50 animate-shake" : (isVerifying ? "border-green-500/50" : "border-white/10 focus:border-brand-blue/50")
              )}
            />
          ))}
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm mb-8 font-medium"
          >
            Incorrect code. Please try again.
          </motion.p>
        )}

        <div className="flex flex-col gap-4">
          <button 
            onClick={handleSubmit}
            disabled={code.some(d => !d)}
            className="w-full bg-brand-paper text-brand-navy py-4 rounded-2xl font-bold hover:bg-white transition-all disabled:opacity-50 shadow-xl"
          >
            Continue
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 text-brand-paper/40 hover:text-brand-paper transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const RoleSelection = ({ onSelect }: { onSelect: (role: 'teen' | 'parent') => void }) => {
  const [pendingRole, setPendingRole] = useState<'teen' | 'parent' | null>(null);

  if (pendingRole) {
    return (
      <SafetyCode 
        role={pendingRole} 
        onVerify={() => onSelect(pendingRole)} 
        onCancel={() => setPendingRole(null)} 
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-brand-navy">
      <div className="atmosphere" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 z-10"
      >
        <h1 className="text-4xl md:text-5xl font-medium text-brand-paper mb-4">Who's using lumin&us®?</h1>
      </motion.div>

      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 z-10">
        {/* Teen Profile */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setPendingRole('teen')}
          className="profile-card group"
        >
          <div className="profile-avatar bg-brand-blue flex items-center justify-center text-brand-navy shadow-2xl">
            <WavesIcon className="w-24 h-24 md:w-28 md:h-28" />
          </div>
          <span className="text-xl md:text-2xl font-medium text-brand-paper/60 group-hover:text-brand-paper transition-colors">Teen</span>
        </motion.button>

        {/* Parent Profile */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setPendingRole('parent')}
          className="profile-card group"
        >
          <div className="profile-avatar bg-brand-yellow flex items-center justify-center text-brand-navy shadow-2xl">
            <AnchorIcon className="w-24 h-24 md:w-28 md:h-28" />
          </div>
          <span className="text-xl md:text-2xl font-medium text-brand-paper/60 group-hover:text-brand-paper transition-colors">Parent</span>
        </motion.button>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-20 px-8 py-2 border border-brand-paper/30 text-brand-paper/50 hover:text-brand-paper hover:border-brand-paper transition-all uppercase tracking-widest text-sm"
        onClick={() => signOut(auth)}
      >
        Manage Profiles
      </motion.button>
    </div>
  );
};

const MoodSelection = ({ onSelect }: { onSelect: (mood: string) => void }) => (
  <div className="fixed inset-0 bg-brand-navy/90 backdrop-blur-xl z-50 flex items-center justify-center p-6">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full text-center"
    >
      <h2 className="text-3xl font-bold text-brand-paper mb-8 font-sans tracking-tight">How are you feeling right now?</h2>
      <div className="grid gap-4">
        {[
          { id: 'safe', label: 'SAFE', desc: 'Doing okay, things feel manageable', color: 'bg-brand-blue' },
          { id: 'struggling', label: 'STRUGGLING', desc: 'Finding things hard, could use support', color: 'bg-brand-yellow' },
          { id: 'drowning', label: 'DROWNING', desc: 'Really not okay right now', color: 'bg-red-500' }
        ].map(mood => (
          <button
            key={mood.id}
            onClick={() => onSelect(mood.id)}
            className="glass-card p-6 text-left hover:scale-[1.02] transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-brand-navy", mood.color)}>
                {mood.label}
              </span>
              <ArrowRight className="w-5 h-5 text-brand-paper/20 group-hover:text-brand-paper transition-colors" />
            </div>
            <p className="text-brand-paper/60 serif-content">{mood.desc}</p>
          </button>
        ))}
      </div>
    </motion.div>
  </div>
);

const ChatBubble = ({ message, onHeart }: { message: ChatMessage, onHeart: (id: string, hearted: boolean) => void }) => {
  const isAssistant = message.sender === 'assistant';
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-6",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div 
        className={cn(
          "max-w-[85%] rounded-[24px] relative group backdrop-blur-md",
          isAssistant 
            ? "border border-black/5 rounded-tl-none shadow-sm" 
            : "bg-brand-blue text-brand-navy shadow-lg shadow-brand-blue/20 rounded-tr-none font-medium p-5"
        )}
        style={isAssistant ? { backgroundColor: '#1E293B', color: '#F1F5F9', padding: '12px 16px' } : {}}
      >
        <div 
          className={cn(
            "prose prose-sm max-w-none serif-content",
            isAssistant ? "" : "text-brand-navy [&_p]:text-brand-navy [&_strong]:text-brand-navy"
          )}
          style={isAssistant ? { color: '#F1F5F9' } : {}}
        >
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
        <div 
          className={cn(
            "text-[10px] mt-2 opacity-40 font-mono uppercase tracking-wider",
            isAssistant ? "" : "text-brand-navy/60"
          )}
          style={isAssistant ? { color: '#94A3B8' } : {}}
        >
          {format(new Date(message.timestamp), 'h:mm a')}
        </div>
        
        {isAssistant && (
          <button 
            onClick={() => onHeart(message.id, !message.isHearted)}
            className={cn(
              "absolute -right-10 top-2 p-2 rounded-full transition-all",
              message.isHearted ? "text-brand-yellow bg-brand-yellow/10" : "text-brand-paper/20 hover:text-brand-yellow opacity-0 group-hover:opacity-100"
            )}
          >
            <Heart className={cn("w-5 h-5", message.isHearted && "fill-current")} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const TeenDashboard = ({ user, onBack }: { user: UserProfile, onBack: () => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'saved'>('chat');
  const [sessionMood, setSessionMood] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef(createAudioRecorder());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionMood) {
      updateAvatarMood(sessionMood as any);
    }
  }, [sessionMood]);

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/messages`),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
      if (msgs.length > 0 && !sessionMood) {
        setSessionMood('safe');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/messages`));
    return unsubscribe;
  }, [user.uid, sessionMood]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const toggleMic = async () => {
    if (isListening) {
      // Stop recording
      setIsListening(false);
      setIsTranscribing(true);
      try {
        const audioBlob = await recorderRef.current.stop();
        const transcript = await transcribeAudio(audioBlob);
        setInputText(transcript);
      } catch (error) {
        console.error('Transcription error:', error);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        await recorderRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Mic access error:', error);
        alert('Please allow microphone access to use voice input');
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    
    const userMsg: Omit<ChatMessage, 'id'> = {
      userId: user.uid,
      text,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    try {
      setIsTyping(true);

      const history = messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const aiResponseRaw = await getChatResponse(text, history, sessionMood || undefined);
      
      // Extract parent theme tags if present
      const themeMatch = aiResponseRaw?.match(/<<PARENT_THEME:(.*?)>>/);
      const extractedParentTheme = themeMatch ? themeMatch[1] : null;

      // Clean AI response immediately
      const aiResponse = aiResponseRaw?.replace(/<<PARENT_THEME:.*?>>/g, '').trim();

      // INSTANT voice - browser SpeechSynthesis, zero network delay
      if (!isMuted && aiResponse) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(aiResponse);
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
        utterance.lang = 'en-GB';
        
        const voices = window.speechSynthesis.getVoices();
        const britishVoice = voices.find(v => 
          v.lang === 'en-GB' && v.name.toLowerCase().includes('female')
        ) || voices.find(v => v.lang === 'en-GB') 
          || voices.find(v => v.lang.startsWith('en'));
        if (britishVoice) utterance.voice = britishVoice;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }

      // extractTheme runs in parallel — doesn't block TTS or UI
      const themePromise = extractTheme(text).catch(() => 'general');

      // Save user message to Firestore
      await addDoc(collection(db, `users/${user.uid}/messages`), userMsg);

      // Show AI message in chat immediately — don't wait for theme
      const aiMsg: Omit<ChatMessage, 'id'> = {
        userId: user.uid,
        text: aiResponse || "I'm here for you. Tell me more?",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, `users/${user.uid}/messages`), aiMsg);
      setIsTyping(false);

      // Resolve theme in background — update parent dashboard quietly
      const theme = await themePromise;
      
      // Update the message document with the resolved theme
      await updateDoc(docRef, { theme });

      const themeRef = collection(db, 'parentThemes');
      await addDoc(themeRef, {
        parentId: "demo-parent",
        childId: user.uid,
        theme: extractedParentTheme || theme,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleHeart = async (id: string, hearted: boolean) => {
    try {
      await updateDoc(doc(db, `users/${user.uid}/messages`, id), { isHearted: hearted });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/messages/${id}`);
    }
  };

  const savedMessages = messages.filter(m => m.isHearted);

  return (
    <div className="flex flex-col h-screen relative">
      {!sessionMood && <MoodSelection onSelect={setSessionMood} />}
      <div className="atmosphere" />
      {/* Header */}
      <header className="bg-brand-navy/80 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-brand-paper/40 hover:text-brand-blue hover:bg-white/5 rounded-xl transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
          </div>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              isMuted ? "text-red-500 bg-red-500/10" : "text-brand-paper/40 hover:text-brand-paper/60"
            )}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === 'chat' ? "bg-brand-blue text-brand-navy shadow-sm" : "text-brand-paper/40 hover:text-brand-paper/60"
            )}
          >
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === 'saved' ? "bg-brand-yellow text-brand-navy shadow-sm" : "text-brand-paper/40 hover:text-brand-paper/60"
            )}
          >
            Hearts
          </button>
        </div>
        <button onClick={() => signOut(auth)} className="p-2 text-brand-paper/40 hover:text-brand-paper/60 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-hidden relative scroll-fade-mask">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
                <div className="sticky top-0 z-20 flex justify-center py-2" style={{ backgroundColor: 'rgb(17, 24, 39)' }}>
                  <Avatar 
                    isTalking={isSpeaking} 
                    isListening={isListening}
                    compact={messages.length > 0} 
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-transparent to-brand-navy pointer-events-none translate-y-full" />
                </div>

                {messages.length === 0 && (
                  <div className="text-center py-8 px-6">
                    <h2 className="text-3xl font-bold text-brand-paper mb-2 font-sans tracking-tight">Hey {user.displayName.split(' ')[0]}!</h2>
                    <p className="text-brand-paper/50 max-w-xs mx-auto serif-content">I'm here to listen. How's your day been so far?</p>
                  </div>
                )}

                <div className="p-6 space-y-2">
                  {messages.map(m => (
                    <ChatBubble key={m.id} message={m} onHeart={toggleHeart} />
                  ))}
                  {isTyping && (
                    <div className="flex justify-start mb-6">
                      <div className="bg-brand-paper p-4 rounded-[28px] rounded-tl-none shadow-sm border border-white/10">
                        <div className="flex gap-1">
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-brand-blue rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-brand-blue rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-brand-blue rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-brand-navy/80 backdrop-blur-xl border-t border-white/10">
                {(isListening || isTranscribing) && (
                  <div className="flex items-center gap-2 mb-3 px-2">
                    {isListening ? (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-red-500 font-medium">Listening...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3 h-3 text-brand-blue animate-spin" />
                        <span className="text-xs text-brand-blue font-medium">Transcribing...</span>
                      </>
                    )}
                  </div>
                )}
                <div className="flex gap-3 items-end">
                  <button 
                    onClick={toggleMic}
                    disabled={isTyping || isTranscribing}
                    className={cn(
                      "p-4 rounded-2xl transition-all duration-300 flex items-center justify-center",
                      isListening 
                        ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse" 
                        : "bg-white/5 text-brand-paper/40 hover:bg-white/10 hover:text-brand-paper/60"
                    )}
                  >
                    {isTranscribing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type or speak your message..."
                      className="w-full bg-white/5 text-brand-paper placeholder:text-brand-paper/20 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 border border-white/10 resize-none min-h-[56px] max-h-32"
                      rows={1}
                    />
                  </div>
                  <button 
                    onClick={handleSend}
                    disabled={!inputText.trim() || isTyping}
                    className={cn(
                      "p-4 rounded-2xl transition-all duration-300 flex items-center justify-center",
                      inputText.trim() && !isTyping
                        ? "bg-brand-blue text-brand-navy shadow-lg shadow-brand-blue/20" 
                        : "bg-white/5 text-brand-paper/20 cursor-not-allowed"
                    )}
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="saved"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto p-6"
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                  <Heart className="w-8 h-8 text-brand-yellow fill-current" />
                  <h2 className="text-4xl font-bold text-brand-paper font-sans tracking-tight">Your Hearts</h2>
                </div>
                {savedMessages.length === 0 ? (
                  <div className="text-center py-20 glass-card border-dashed">
                    <Heart className="w-12 h-12 text-brand-paper/10 mx-auto mb-4" />
                    <p className="text-brand-paper/40 serif-content">Heart messages you want to keep as reminders.</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {savedMessages.map(m => (
                      <motion.div 
                        layout
                        key={m.id}
                        className="glass-card p-6 relative group"
                      >
                        <div className="prose prose-sm max-w-none serif-content">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-[10px] text-brand-paper/30 uppercase tracking-widest font-mono">
                            Saved {format(new Date(m.timestamp), 'MMM d')}
                          </span>
                          <button 
                            onClick={() => toggleHeart(m.id, false)}
                            className="p-2 text-brand-paper/20 hover:text-brand-yellow hover:bg-white/5 rounded-full transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

const ParentDashboard = ({ user, onBack }: { user: UserProfile, onBack: () => void }) => {
  const [themes, setThemes] = useState<ParentTheme[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // In a real app, we'd query themes for this parent's child
    const q = query(collection(db, 'parentThemes'), orderBy('lastUpdated', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setThemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentTheme)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'parentThemes'));
    return unsubscribe;
  }, []);

  const fetchSuggestions = async (theme: string) => {
    if (suggestions[theme]) return;
    setLoadingSuggestions(prev => ({ ...prev, [theme]: true }));
    try {
      const res = await getParentSuggestions(theme);
      setSuggestions(prev => ({ ...prev, [theme]: res || "No suggestions available." }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSuggestions(prev => ({ ...prev, [theme]: false }));
    }
  };

  return (
    <div className="min-h-screen relative bg-brand-navy">
      <div className="atmosphere" />
      <header className="bg-brand-navy/80 backdrop-blur-xl border-b border-white/10 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-brand-paper/40 hover:text-brand-blue hover:bg-white/5 rounded-xl transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-8 w-px bg-white/10 mx-2" />
            <div>
              <h1 className="text-xl font-bold text-brand-paper font-sans tracking-tight">Parent Dashboard</h1>
              <p className="text-xs text-brand-paper/40 serif-content">Connecting with your teen</p>
            </div>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="p-3 text-brand-paper/40 hover:text-brand-paper/60 hover:bg-white/5 rounded-2xl transition-all">
          <LogOut className="w-6 h-6" />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <div className="glass-card p-8 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Info className="w-6 h-6 text-brand-blue" />
            <h2 className="text-xl font-bold text-brand-paper">Privacy Notice</h2>
          </div>
          <p className="text-brand-paper/60 leading-relaxed serif-content">
            lumin&us® protects your teen's privacy to help them feel safe opening up. 
            You will only see general wellbeing themes here, never their actual words. 
            Use these themes to find meaningful ways to connect.
          </p>
        </div>

        <h2 className="text-4xl font-bold text-brand-paper mb-8 font-sans tracking-tight">Wellbeing Themes</h2>
        
        {themes.length === 0 ? (
          <div className="text-center py-20 glass-card border-dashed">
            <Sparkles className="w-12 h-12 text-brand-paper/10 mx-auto mb-4" />
            <p className="text-brand-paper/40 serif-content">Themes will appear here as your teen uses the app.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            {themes.map(t => (
              <motion.div 
                key={t.id}
                className="glass-card overflow-hidden"
              >
                <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center px-4 py-1.5 bg-brand-blue/10 text-brand-blue rounded-full text-sm font-bold uppercase tracking-wider mb-4 border border-brand-blue/20">
                      {t.theme}
                    </div>
                    <h3 className="text-2xl font-bold text-brand-paper mb-2">Connection Opportunities</h3>
                    <p className="text-brand-paper/40 serif-content">Last updated {format(new Date(t.lastUpdated), 'MMM d, h:mm a')}</p>
                  </div>
                  <button 
                    onClick={() => fetchSuggestions(t.theme)}
                    className="bg-brand-blue text-brand-navy px-8 py-4 rounded-2xl font-semibold hover:bg-brand-blue/90 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loadingSuggestions[t.theme] ? "Loading..." : "Get Activity Ideas"}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                
                <AnimatePresence>
                  {suggestions[t.theme] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-white/5 border-t border-white/10 p-8"
                    >
                      <div className="prose prose-sm max-w-none serif-content">
                        <ReactMarkdown>{suggestions[t.theme]}</ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [sessionRole, setSessionRole] = useState<'teen' | 'parent' | null>(null);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setShowDisclaimer(true);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          // If no user doc, we'll create one on role selection
          setUser(null);
        }
      } else {
        setUser(null);
        setSessionRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowDisclaimer(true);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError('A previous sign-in attempt is still pending. Please wait or refresh the page.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('The sign-in window was closed before completion. Please try again.');
      } else if (error.code === 'auth/user-cancelled') {
        setLoginError('The sign-in request was cancelled. Please try again if you wish to sign in.');
      } else {
        setLoginError('An error occurred during sign-in. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRoleSelect = async (role: 'teen' | 'parent') => {
    if (!auth.currentUser) return;
    
    // If user already exists in Firestore, we just set session role
    // Otherwise, we create the user doc first
    if (!user) {
      const newUser: UserProfile = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || 'User',
        role,
        createdAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), newUser);
        setUser(newUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      }
    }
    
    setSessionRole(role);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-brand-navy">
        <div className="atmosphere" />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="w-24 h-24 bg-brand-blue rounded-3xl flex items-center justify-center shadow-2xl text-brand-navy"
        >
          <LighthouseIcon className="w-16 h-16" />
        </motion.div>
      </div>
    );
  }

  // If not logged in, show landing
  if (!auth.currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-brand-navy">
        <div className="atmosphere" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl z-10"
        >
          <div className="w-32 h-32 bg-brand-blue rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/10 text-brand-navy">
            <LighthouseIcon className="w-20 h-20" />
          </div>
          
          <Logo size="xl" className="mb-6" />
          
          <p className="text-xl text-brand-paper/60 mb-12 leading-relaxed serif-content max-w-lg mx-auto">
            Beacon Family Services. A safe space for teens to talk and a bridge for families to connect. 
          </p>
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={cn(
              "bg-brand-blue text-brand-navy px-12 py-5 rounded-[24px] font-bold text-lg hover:bg-brand-blue/90 transition-all shadow-2xl flex items-center gap-3 mx-auto group",
              isLoggingIn && "opacity-50 cursor-not-allowed"
            )}
          >
            <UserIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            {isLoggingIn ? 'Signing in...' : 'Sign in'}
          </button>
          
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-sm max-w-md mx-auto"
            >
              {loginError}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // If logged in but no session role, show role selection (profile picker)
  if (!sessionRole) {
    return (
      <>
        {showDisclaimer && <Disclaimer onAccept={() => setShowDisclaimer(false)} />}
        <RoleSelection onSelect={handleRoleSelect} />
      </>
    );
  }

  // If session role is set, show the dashboard
  return (
    <>
      {sessionRole === 'teen' ? (
        <TeenDashboard user={user!} onBack={() => setSessionRole(null)} />
      ) : (
        <ParentDashboard user={user!} onBack={() => setSessionRole(null)} />
      )}
    </>
  );
}
