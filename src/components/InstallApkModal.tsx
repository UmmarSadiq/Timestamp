import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Terminal,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface InstallApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallApkModal: React.FC<InstallApkModalProps> = ({ isOpen, onClose }) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pwabuilder' | 'webapk' | 'capacitor'>('pwabuilder');

  // Detect PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on Android Chrome: Tap the 3 dots menu (⋮) at top right and select "Install app" or "Add to Home screen".');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const pwabuilderUrl = `https://www.pwabuilder.com/?url=${encodeURIComponent(currentUrl)}`;

  const capacitorCommands = `# 1. Export & unzip the project from AI Studio (Settings > Export)
# 2. In your terminal, inside the project folder:
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Timestamp Camera" com.timestamp.camera --web-dir=dist
npm run build
npx cap add android
npx cap open android

# 3. In Android Studio: Click "Build" > "Build APK(s)" to produce your .apk file!`;

  return (
    <div
      id="apk-conversion-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0f0f13] w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col border border-zinc-800/80 shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#131317]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Convert to Android APK / Install
              </h2>
              <p className="text-xs text-zinc-400">Choose the fastest way to get your Android app & APK</p>
            </div>
          </div>
          <button
            id="close-apk-modal-btn"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex border-b border-zinc-800/80 bg-[#131317] px-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`flex-1 min-w-[130px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'pwabuilder'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1-Click APK (Cloud)</span>
          </button>
          <button
            onClick={() => setActiveTab('webapk')}
            className={`flex-1 min-w-[120px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'webapk'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct WebAPK</span>
          </button>
          <button
            onClick={() => setActiveTab('capacitor')}
            className={`flex-1 min-w-[130px] py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'capacitor'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Android Studio</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          
          {/* TAB 1: PWABUILDER (Instant 1-click cloud APK) */}
          {activeTab === 'pwabuilder' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-amber-400/10 border border-amber-400/20 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>RECOMMENDED: 1-Click Free Cloud APK Generation</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  The app is fully configured with a PWA manifest, high-res icons, and offline caching. PWABuilder (backed by Microsoft & Google Web Ecosystem) packages this web app into a signed Android <strong>.apk</strong> or <strong>.aab</strong> package in 60 seconds without installing any SDKs.
                </p>
              </div>

              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                  Step 1: Your Live Applet URL
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentUrl}
                    className="flex-1 bg-[#0d0d10] border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 truncate"
                  />
                  <button
                    onClick={() => handleCopy(currentUrl, 'url')}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedText === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                  Step 2: Generate APK on PWABuilder
                </span>
                <ol className="space-y-2 text-xs text-zinc-300 list-decimal list-inside leading-relaxed">
                  <li>Click the button below to open PWABuilder with your URL pre-filled.</li>
                  <li>Click <strong className="text-amber-400">"Package For Stores"</strong> or <strong className="text-amber-400">"Android"</strong>.</li>
                  <li>Click <strong className="text-amber-400">"Generate Package"</strong> to download your ready-to-install Android APK / AAB.</li>
                </ol>

                <a
                  href={pwabuilderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-2 py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-400/20 active:scale-98"
                >
                  <span>Open PWABuilder & Generate APK</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT WEBAPK INSTALLATION */}
          {activeTab === 'webapk' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#16161b] p-5 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      Direct Android Installation (WebAPK)
                    </span>
                    <p className="text-xs text-zinc-400">
                      Android automatically creates and installs a native WebAPK package directly from Chrome.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-400/20 active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalled ? 'App Already Installed' : 'Install Directly onto Android'}</span>
                  </button>

                  <div className="bg-[#0e0e12] p-3 rounded-xl border border-zinc-800/80 text-xs text-zinc-300 space-y-1.5">
                    <p className="font-semibold text-amber-300">How to install manually on Android:</p>
                    <p>1. Open this app in Google Chrome on your Android phone.</p>
                    <p>2. Tap the three dots menu (⋮) in the top right corner.</p>
                    <p>3. Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
                    <p>4. Android will package it as a standalone app with hardware camera and gallery integration.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAPACITOR / ANDROID STUDIO NATIVE BUILD */}
          {activeTab === 'capacitor' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Compile Native APK via Capacitor & Android Studio
                  </span>
                  <button
                    onClick={() => handleCopy(capacitorCommands, 'cap')}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedText === 'cap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'cap' ? 'Copied' : 'Copy Commands'}</span>
                  </button>
                </div>

                <div className="bg-[#0a0a0d] p-3 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                  <pre>{capacitorCommands}</pre>
                </div>
              </div>

              <div className="bg-[#16161b] p-4 rounded-2xl border border-zinc-800 text-xs text-zinc-300 space-y-2">
                <p className="font-semibold text-amber-300">Tips for Google Play Store:</p>
                <p>
                  In Android Studio, select <strong>Build &gt; Generate Signed Bundle / APK</strong> to generate a release <code>.aab</code> bundle for the Google Play Console.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-[#131317] flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            PWA Manifest & Icons Ready
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs transition-all active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
