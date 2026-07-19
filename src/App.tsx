/** @jsxImportSource react */
import React, { useState, useEffect } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  Stethoscope, 
  Building2, 
  Pill, 
  Activity, 
  Smartphone, 
  Tag, 
  Check, 
  X, 
  CreditCard, 
  Download, 
  Sparkles,
  Wifi,
  Battery,
  LogIn,
  Lock,
  Search,
  ArrowRight
} from 'lucide-react';
import WhatsAppButton from './components/WhatsAppButton';

// API base URL detection
declare global {
  interface Window { __API_BASE: string; }
}
const API_BASE = typeof window !== 'undefined' && window.__API_BASE ? window.__API_BASE : '/api';

// CPF helpers
function maskCPF(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) return v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6,9) + '-' + v.slice(9);
  if (v.length > 6) return v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6);
  if (v.length > 3) return v.slice(0,3) + '.' + v.slice(3);
  return v;
}
function validateCPF(n: string): boolean {
  n = n.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0, r: number;
  for (let i = 1; i <= 9; i++) s += +n.charAt(i-1) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +n.charAt(9)) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += +n.charAt(i-1) * (12 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== +n.charAt(10)) return false;
  return true;
}

export default function App() {
  // CPF modal state (unified for both "Solicitar" and "Acessar")
  const [isCpfModalOpen, setIsCpfModalOpen] = useState(false);
  const [cpfValue, setCpfValue] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfResult, setCpfResult] = useState<'idle' | 'found' | 'notfound'>('idle');
  const [cpfClientName, setCpfClientName] = useState('');
  const [cpfClientLimite, setCpfClientLimite] = useState('');
  const [cpfClientId, setCpfClientId] = useState('');

  // Security popup state
  const [isSecurityPopupOpen, setIsSecurityPopupOpen] = useState(false);
  const [securityPopupCountdown, setSecurityPopupCountdown] = useState(8);
  const securityPopupDuration = 30;

  // Fetch settings — show security popup after 5s delay
  useEffect(() => {
    fetch(API_BASE + '/admin/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings?.security_popup_enabled === 'true') {
          setTimeout(() => {
            setIsSecurityPopupOpen(true);
            setSecurityPopupCountdown(securityPopupDuration);
          }, 5000);
        }
      })
      .catch(() => {});
  }, []);

  // Countdown timer for security popup
  useEffect(() => {
    if (!isSecurityPopupOpen) return;
    if (securityPopupCountdown <= 0) { setIsSecurityPopupOpen(false); return; }
    const timer = setInterval(() => {
      setSecurityPopupCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSecurityPopupOpen, securityPopupCountdown]);

  // Preload carousel images into memory
  useEffect(() => {
    const imgs = ['/assets/FARMI1.webp', '/assets/FARMI2.webp'];
    imgs.forEach(src => { const i = new Image(); i.src = src; });
  }, []);

  // App download modal states
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [downloadStep, setDownloadStep] = useState<'initial' | 'loading' | 'error'>('initial');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Auto-scroller
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  // Unified download flow: register click → loading → error + WhatsApp
  const handleDownloadClick = async () => {
    // 1° Register click immediately — tenta obter client_id do sessionStorage (cliente que já passou pelo cadastro)
    try {
      const storedClientId = sessionStorage.getItem('vs_clientId') || '';
      const storedNome = sessionStorage.getItem('vs_nome_completo') || '';
      const storedCpf = sessionStorage.getItem('credvale_cpf') || '';
      const payload = { client_id: storedClientId, client_cpf: storedCpf.replace(/\D/g, ''), client_nome: storedNome, apk_available: true, device_info: navigator.userAgent || '' };
      navigator.sendBeacon(API_BASE + '/app/register-download', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      // Busca WhatsApp configurado para usar no botão de erro
      const cfgResp = await fetch(API_BASE + '/payments/config');
      const cfg = await cfgResp.json();
      if (cfg && cfg.whatsapp) {
        sessionStorage.setItem('vs_support_wa', String(cfg.whatsapp).replace(/\D/g, ''));
      }
    } catch (e) {}

    // 2° Show loading with progress simulation
    setDownloadStep('loading');
    setDownloadProgress(0);

    // Simulate progress for 8 seconds
    let pct = 0;
    const interval = setInterval(() => {
      pct += Math.floor(Math.random() * 12) + 5;
      if (pct >= 100) pct = 100;
      setDownloadProgress(pct);
    }, 200);

    // 3° After 8 seconds, show error
    setTimeout(() => {
      clearInterval(interval);
      setDownloadProgress(100);
      setDownloadStep('error');
    }, 8000);
  };

  // CPF modal handlers — unified flow
  const openCpfModal = () => {
    setCpfValue('');
    setCpfError('');
    setCpfLoading(false);
    setCpfResult('idle');
    setCpfClientName('');
    setIsCpfModalOpen(true);
  };

  const handleCpfInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    setCpfValue(maskCPF(raw));
    setCpfError('');
  };

  const handleCpfSubmit = async () => {
    const cpf = cpfValue.replace(/\D/g, '');
    if (!cpf || cpf.length !== 11) { setCpfError('Informe um CPF válido.'); return; }
    if (!validateCPF(cpf)) { setCpfError('CPF inválido.'); return; }
    
    setCpfLoading(true);
    setCpfError('');
    
    try {
      const res = await fetch(API_BASE + '/cpf/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf })
      });
      const data = await res.json();
      
      if (data.exists && data.cliente) {
        // CPF encontrado — salva dados e mostra resultado
        setCpfClientName(data.cliente.nome || '');
        setCpfClientLimite(data.cliente.limite || '0');
        setCpfClientId(data.cliente.id || '');
        setCpfResult('found');
        // Salva no sessionStorage para cadastro.html pré-preenchido
        try {
          sessionStorage.setItem('credvale_cpf', cpfValue);
          sessionStorage.setItem('credvale_name', data.cliente.nome || '');
        } catch(e) {}
      } else {
        // CPF não encontrado
        setCpfResult('notfound');
        // Salva CPF para cadastro.html
        try {
          sessionStorage.setItem('credvale_cpf', cpfValue);
        } catch(e) {}
      }
    } catch (err) {
      setCpfError('Não foi possível consultar seu cadastro. Tente novamente.');
    } finally {
      setCpfLoading(false);
    }
  };

  // Redirect to cadastro.html (new registration)
  const goToCadastro = () => {
    window.location.href = '/cadastro.html';
  };

  // Redirect to cadastro.html (continue existing registration)
  const continueCadastro = () => {
    window.location.href = '/cadastro.html';
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center py-0 sm:py-6 font-sans antialiased text-gray-800">
      
      <div 
        id="app-container" 
        className="w-full max-w-[430px] h-screen sm:h-[768px] sm:max-h-[768px] sm:rounded-[24px] sm:shadow-2xl bg-[#F7FAFC] overflow-y-auto relative flex flex-col border-x border-slate-300 scrollbar-none scroll-smooth"
      >
        
        {/* Status Bar for Desktop */}
        <div className="hidden sm:flex justify-between items-center px-6 pt-3 pb-1 bg-white sticky top-0 z-50 text-[12px] font-semibold text-gray-700 select-none border-b border-gray-100">
          <span>09:41</span>
          <div className="w-16 h-4 bg-gray-900 rounded-full flex items-center justify-center opacity-80">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
            <span className="text-[9px] text-white font-bold leading-none">CredVale</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-gray-700" />
            <span className="text-[10px]">5G</span>
            <Battery className="w-4 h-4 text-gray-700" />
          </div>
        </div>

        {/* HEADER */}
        <header className="sticky top-0 z-40 bg-white shadow-sm px-4 h-[72px] flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('app-container')}>
            <img src="/assets/logo-app.png" alt="CredVale" width="40" height="40" className="w-10 h-10 rounded-xl object-cover shadow-md shadow-blue-500/20" />
            <div>
              <span className="font-display font-bold text-xl tracking-tight text-[#1F2937]">
                Cred<span className="text-[#0B6CF4]">Vale</span>
              </span>
              <p className="text-[9px] text-[#6B7280] uppercase tracking-wider font-semibold">Benefícios</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Acessar Conta (CPF) */}
            <button 
              onClick={openCpfModal}
              className="text-[10px] font-bold text-[#0B6CF4] bg-[#0B6CF4]/8 hover:bg-[#0B6CF4]/15 px-2.5 py-2 rounded-lg transition-all border border-[#0B6CF4]/15 flex items-center gap-1"
            >
              <LogIn className="w-3 h-3" />
              <span className="hidden md:inline">Acessar</span>
            </button>

            <button 
              onClick={goToCadastro}
              className="bg-[#0B6CF4] hover:bg-[#1788FF] text-white text-xs sm:text-sm font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-md shadow-blue-500/10 transition-all active:scale-95 duration-200"
            >
              Assinar CredVale
            </button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1">

          {/* HERO SECTION */}
          <section className="bg-gradient-to-b from-white to-[#F7FAFC] pb-6">
            <div className="p-4">
              {/* Hero image */}
              <img 
                src="/assets/hero222.webp" 
                alt="CredVale - Cartão de Benefícios"
                className="w-full rounded-2xl shadow-md border border-gray-100 object-cover"
                loading="eager"
                fetchpriority="high"
                width="1200" height="675"
              />
            </div>

            <div className="px-5 pt-2 animate-fadeIn">
              <h1 className="font-display text-[26px] sm:text-[28px] font-black leading-tight tracking-tight">
                <span className="text-[#00C853]">Cuidar</span>{' '}
                <span className="text-[#1F2937]">da sua saúde nunca foi tão simples.</span>
              </h1>
              <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-[14px] text-[#4B5563] leading-relaxed mb-4">
                  Com a <strong className="text-[#0B6CF4] font-bold">CredVale</strong> você economiza todos os meses.
                </p>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">
                  Tenha acesso a descontos de até{' '}
                  <strong className="text-[#0B6CF4] font-extrabold">75% em medicamentos</strong>
                  {' '}nas maiores redes credenciadas do Brasil e solicite seu cartão com limite de até{' '}
                  <strong className="text-[#00C853] font-extrabold">R$ 5.000</strong>
                  , sujeito à análise de crédito.
                </p>
                <p className="text-[12px] text-[#9CA3AF] mt-3 leading-relaxed">
                  Tudo isso em uma única plataforma, com praticidade, economia e benefícios exclusivos.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-blue-200">
                  <div className="w-9 h-9 rounded-lg bg-[#0B6CF4]/10 flex items-center justify-center mb-2.5">
                    <CreditCard className="w-4.5 h-4.5 text-[#0B6CF4]" />
                  </div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Cartão de Crédito</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">Limite de até R$ 5.000*</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-blue-200">
                  <div className="w-9 h-9 rounded-lg bg-[#0B6CF4]/10 flex items-center justify-center mb-2.5">
                    <Pill className="w-4.5 h-4.5 text-[#0B6CF4]" />
                  </div>
                  <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Convênio Farmacêutico</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">Apenas R$ 1,66/mês</p>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100" />

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2.5 text-[13px] text-[#4B5563]">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span className="font-medium">Análise em até 2 minutos</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-[#4B5563]">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span className="font-medium">Mais economia todo mês</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-[#4B5563]">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span className="font-medium">Mais praticidade no dia a dia</span>
                </div>
              </div>

              <p className="mt-2 text-[10px] text-[#9CA3AF] text-center">*Sujeito à análise de crédito.</p>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  onClick={goToCadastro}
                  className="w-full bg-[#00C853] hover:bg-[#00b049] text-white text-base font-bold py-3.5 px-6 rounded-xl shadow-md shadow-green-500/15 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4.5 h-4.5" />
                  Assinar CredVale
                </button>
                
                {/* Link para quem já tem conta */}
                <button
                  onClick={openCpfModal}
                  className="w-full text-sm font-semibold text-[#0B6CF4] hover:text-[#1788FF] py-2 transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Já tenho conta - Acessar meu cartão
                </button>
              </div>

              {/* Quick Benefits */}
              <div className="mt-4 grid grid-cols-1 gap-1.5 bg-white p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 text-sm text-[#1F2937] font-medium">
                  <div className="w-4.5 h-4.5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span>Aprovação rápida e sem burocracia</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1F2937] font-medium">
                  <div className="w-4.5 h-4.5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span>Sem carência - Use hoje mesmo</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1F2937] font-medium">
                  <div className="w-4.5 h-4.5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-[#00C853] stroke-[3]" />
                  </div>
                  <span>Atendimento 100% humanizado</span>
                </div>
              </div>
            </div>
          </section>

          {/* FARMÁCIAS PARCEIRAS SECTION */}
          <section className="bg-white py-4 px-4 border-y border-gray-100">
            <div className="text-center mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#0B6CF4] bg-[#0B6CF4]/10 px-3 py-1.5 rounded-full">
                Grandes Marcas
              </span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Rede de Farmácias Parceiras
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Compre com descontos garantidos em mais de 15.000 farmácias parceiras por todo o país.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg">
              <div className="carousel-track">
                <div className="carousel-slide"><img src="/assets/FARMI1.webp" alt="" className="carousel-img" width="400" height="155" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI2.webp" alt="" className="carousel-img" width="400" height="153" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI1.webp" alt="" className="carousel-img" width="400" height="155" /></div>
                <div className="carousel-slide"><img src="/assets/FARMI2.webp" alt="" className="carousel-img" width="400" height="153" /></div>
              </div>
            </div>
            <style>{`
               .carousel-track{display:flex;width:400%;animation:scrollFarmi 15s linear infinite;will-change:transform}
               .carousel-slide{flex-shrink:0;width:25%;height:128px;overflow:hidden}
               .carousel-img{width:100%;height:100%;object-fit:cover;display:block}
               @keyframes scrollFarmi{
                 0%,25%{transform:translateX(0)}
                 45%{transform:translateX(-25%)}
                 80%{transform:translateX(-25%)}
                 100%{transform:translateX(-50%)}
               }                   @media(min-width:640px){.carousel-slide{height:150px}}
            `}</style>
            <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.animate-fadeIn{animation:fadeInUp .6s ease forwards}`}</style>
          </section>


          {/* APP SECTION */}
          <section className="bg-gradient-to-b from-[#F7FAFC] to-white py-6 px-5">
            <div className="text-center mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full">
                Tecnologia & Praticidade
              </span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Tudo na palma da sua mão.
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Acesse o cartão digital, consulte o saldo e veja farmácias perto de você num piscar de olhos.
              </p>
            </div>

            {/* App showcase image - novopp */}
            <div className="-mx-5 my-4">
              <img 
                src="/assets/app-2.webp" 
                alt="CredVale - Aplicativo"
                className="w-full object-cover"
                loading="lazy"
                width="600" height="636"
              />
            </div>

            <div className="text-center">
              <button
                onClick={() => { setIsDownloadOpen(true); setDownloadStep('initial'); setDownloadProgress(0); }}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-5 rounded-xl shadow-md transition-all active:scale-95 duration-200 text-xs sm:text-sm"
              >
                <Download className="w-4 h-4" />
                Baixar o aplicativo grátis
              </button>
              <p className="text-[10px] text-[#6B7280] mt-1.5">Disponível para Android e iOS</p>
            </div>
          </section>

          {/* BENEFÍCIOS SECTION */}
          <section className="bg-white py-6 px-5 border-y border-gray-100">
            <div className="text-center mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-[#0B6CF4] bg-[#0B6CF4]/10 px-3 py-1.5 rounded-full">
                Vantagens Reais
              </span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Por que escolher a CredVale?
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Uma rede completa desenhada para sua tranquilidade financeira.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Stethoscope className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Consultas com desconto</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Presencial ou telemedicina com médicos experientes.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Clínicas parceiras</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Rede credenciada em localizações estratégicas.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Pill className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Farmácias conveniadas</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Até 75% de desconto em medicamentos essenciais.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Descontos em exames</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">De laboratoriais a exames de alta complexidade.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Smartphone className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Tudo no Aplicativo</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Cartão virtual, guia de parceiros e muito mais.</p>
              </div>
              <div className="bg-[#F7FAFC] p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition-all duration-200">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm border border-blue-100/30 text-[#0B6CF4] mb-2.5">
                  <Tag className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-gray-800 leading-tight">Descontos extras</h3>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">Parcerias exclusivas com óticas e academias.</p>
              </div>
            </div>
          </section>

          {/* PLAN SECTION */}
          <section className="bg-gradient-to-b from-white to-[#F7FAFC] py-6 px-5">
            <div className="text-center mb-5">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full">
                Plano Exclusivo
              </span>
              <h2 className="font-display text-[21px] sm:text-[22px] font-bold text-[#1F2937] mt-2.5">
                Valor justo para sua saúde
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
                Uma assinatura mensal simples, sem taxas escondidas.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#0B6CF4] text-white text-[10px] font-bold uppercase py-1 px-4 rounded-bl-xl">
                Mais Escolhido
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900">Plano CredVale</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Ideal para quem deseja economizar de verdade em saúde e medicamentos todos os meses.
              </p>
              <div className="my-5">
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-extrabold text-gray-900">R$</span>
                  <span className="text-4xl font-black text-[#0B6CF4] tracking-tight">1,66</span>
                  <span className="text-xs font-semibold text-[#6B7280]">/mês</span>
                </div>
                <p className="text-[10px] text-green-600 font-bold mt-1">✓ Sem limite de idade • Sem carência • Cancele quando quiser</p>
              </div>
              <div className="space-y-3 border-t border-gray-100 pt-4 pb-5">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#0B6CF4] stroke-[3]" />
                  </div>
                  <span className="font-medium">Consultas Médicas Ilimitadas</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#0B6CF4] stroke-[3]" />
                  </div>
                  <span className="font-medium">Exames com até 70% de desconto</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#0B6CF4] stroke-[3]" />
                  </div>
                  <span className="font-medium">Medicamentos com até 75% desconto</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#0B6CF4] stroke-[3]" />
                  </div>
                  <span className="font-medium">Aplicativo CredVale Integrado</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-[#0B6CF4] stroke-[3]" />
                  </div>
                  <span className="font-medium">Rede de Clínicas Credenciadas</span>
                </div>
              </div>
              <button
                onClick={goToCadastro}
                className="w-full bg-[#00C853] hover:bg-[#00b049] text-white text-sm sm:text-base font-bold py-3.5 rounded-xl shadow-md shadow-green-500/15 transition-all active:scale-95 duration-200"
              >
                Assinar agora
              </button>
            </div>
          </section>

          {/* CTA FINAL SECTION */}
          <section className="bg-[#0B6CF4] text-white py-8 px-5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
            <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-black/5 rounded-full blur-xl"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-white/10 px-3 py-1.2 rounded-full inline-block">
              Aproveite Hoje Mesmo
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold mt-2.5 leading-snug">
              Comece hoje mesmo.
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Assine o CredVale e passe a economizar de forma inteligente em exames e medicamentos.
            </p>
            <button
              onClick={goToCadastro}
              className="mt-5 bg-white text-[#0B6CF4] hover:bg-blue-50 text-sm font-bold py-3 px-6 rounded-xl shadow-md transition-all active:scale-95 duration-200"
            >
              Quero meu cartão
            </button>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="bg-slate-900 text-slate-400 py-6 px-5 border-t border-slate-800 text-xs text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start gap-1.5 mb-5">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#0B6CF4] flex items-center justify-center text-white">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base text-white tracking-tight">
                Cred<span className="text-[#0B6CF4]">Vale</span>
              </span>
            </div>
            <p className="text-slate-500 text-[10px] mt-1 text-center sm:text-left">
              CredVale Intermediação de Serviços de Saúde Ltda.
            </p>
          </div>

          <div className="space-y-1.5 text-slate-400 border-t border-slate-800/60 pt-3 text-[11px]">
            <p><strong className="text-slate-300">CNPJ:</strong> 42.109.873/0001-92</p>
            <p><strong className="text-slate-300">Endereço:</strong> Av. Paulista, 1000, Bela Vista, São Paulo - SP</p>
            <p><strong className="text-slate-300">Telefone:</strong> 0800 591 0233</p>
            <p><strong className="text-slate-300">E-mail:</strong> contato@credvale.com.br</p>
          </div>

          <div className="flex justify-center sm:justify-start gap-3 mt-5 text-[10px] text-slate-500 border-t border-slate-800/60 pt-3">
            <a href="/admin.html" className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Admin
            </a>
            <span>•</span>
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
            <span>•</span>
            <a href="#terms" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
          </div>

          <p className="text-[9px] text-slate-600 mt-5 text-center">
            &copy; 2026 CredVale. Todos os direitos reservados.
          </p>
        </footer>

        {/* SECURITY INSTITUTIONAL POPUP */}
        <AnimatePresence>
          {isSecurityPopupOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-[420px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-0">
                  <div className="flex items-center gap-2">
                    <img src="/assets/logo-app.png" alt="CredVale" className="w-8 h-8 rounded-lg object-cover" />
                    <span className="font-display font-bold text-sm text-[#1F2937]">CredVale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#6B7280] bg-slate-100 px-2 py-1 rounded-lg">{securityPopupCountdown}s</span>
                    <button onClick={() => setIsSecurityPopupOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="px-5 pt-3 pb-5">
                  <h3 className="font-display font-extrabold text-base text-[#1F2937] mb-3">
                    🔒 Aviso Importante
                  </h3>
                  <div className="text-xs text-[#4B5563] leading-relaxed space-y-2.5">
                    <p className="font-extrabold text-[#0B6CF4] text-sm bg-blue-50 -mx-1 px-3 py-2.5 rounded-xl border border-blue-100">
                      A CredVale <span className="text-[#DC2626]">NÃO</span> cobra qualquer valor antecipado.
                    </p>
                    <p>
                      A CredVale NÃO cobra qualquer valor antecipado para análise, aprovação ou liberação de crédito.
                    </p>
                    <p>
                      Não solicitamos depósitos, PIX, transferências ou qualquer pagamento antecipado para liberar limites ou concluir cadastros.
                    </p>
                    <p>
                      Se alguém pedir qualquer valor em nome da CredVale antes da contratação, desconsidere a solicitação e entre em contato com nossos canais oficiais.
                    </p>
                    <p className="font-semibold text-[#1F2937] pt-1">
                      Sua segurança e transparência são prioridades para nós.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSecurityPopupOpen(false)}
                    className="mt-4 w-full bg-[#0B6CF4] hover:bg-[#1788FF] text-white font-bold py-3 rounded-xl transition-all active:scale-95 duration-200 text-sm"
                  >
                    Entendi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* WHATSAPP FLOATING BUTTON — só aparece após pop-up de segurança fechar */}
        {!isSecurityPopupOpen && <WhatsAppButton />}

        {/* DOWNLOAD APP MODAL */}
        <AnimatePresence>
          {isDownloadOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[360px] bg-white rounded-3xl overflow-hidden shadow-2xl p-6 border border-slate-100"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-1.5">
                    <Smartphone className="w-5 h-5 text-[#0B6CF4]" />
                    Instalar CredVale App
                  </h3>
                  <button onClick={() => setIsDownloadOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {downloadStep === 'initial' ? (
                  <div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Faça o download do aplicativo CredVale diretamente para o seu celular.
                    </p>
                    <div className="mt-5">
                      <button onClick={handleDownloadClick}
                        className="w-full bg-[#0B6CF4] hover:bg-[#1788FF] text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 duration-200 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Baixar Aplicativo
                      </button>
                      <p className="text-[10px] text-gray-400 text-center mt-2">Arquivo APK oficial CredVale</p>
                    </div>
                  </div>
                ) : downloadStep === 'loading' ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-[#0B6CF4] rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm font-bold text-slate-800">Preparando a instalação do CredVale App...</p>
                    <p className="text-xs text-gray-500 mt-1">Estamos preparando o aplicativo para o seu dispositivo.</p>
                    <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#0B6CF4] h-full transition-all duration-200" style={{ width: `${downloadProgress}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">{downloadProgress}%</p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm font-extrabold text-red-600 mb-3">📱 Instalar CredVale App</p>
                    <p className="text-xs font-bold text-red-600 leading-relaxed mb-2">
                      😕 ⚠️ Houve um problema ao baixar o aplicativo.
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      Isso normalmente acontece quando a versão disponível não é compatível com o seu dispositivo.
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      Nossa equipe pode enviar a versão correta para você e ajudar na instalação.
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Clique no botão abaixo e fale agora com um de nossos atendentes.
                    </p>
                    <a
                      href={(() => {
                        var wa = sessionStorage.getItem('vs_support_wa') || '';
                        return wa ? 'https://wa.me/' + wa.replace(/\D/g, '') + '?text=Ol%C3%A1%21+Quero+ajuda+para+baixar+o+aplicativo+CredVale.' : '#';
                      })()}
                      target="_blank"
                      rel="noopener"
                      className="block w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:opacity-95 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 duration-200 mb-2 text-sm"
                    >
                      💬 Falar com um atendente
                    </a>
                    <button onClick={() => { setIsDownloadOpen(false); setDownloadStep('initial'); }}
                      className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 py-2"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* UNIFIED CPF MODAL — 3 states: idle, found, notfound */}
        <AnimatePresence>
          {isCpfModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[380px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
              >
                {/* CPF INPUT STATE */}
                {cpfResult === 'idle' && (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-1.5">
                        <Search className="w-5 h-5 text-[#0B6CF4]" />
                        Consultar CPF
                      </h3>
                      <button onClick={() => { setIsCpfModalOpen(false); setCpfResult('idle'); }} 
                        className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-5">
                      Informe seu CPF para verificar se você já possui cadastro ou iniciar uma nova solicitação.
                    </p>

                    <div className="mb-5">
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">CPF</label>
                      <input type="text" value={cpfValue}
                        onChange={handleCpfInput}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCpfSubmit(); }}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={`w-full px-4 py-3.5 bg-white border ${cpfError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-[#0B6CF4] focus:ring-[#0B6CF4]'} rounded-xl text-sm focus:outline-none focus:ring-1`}
                        autoFocus
                      />
                      {cpfError && <p className="text-[10px] text-red-500 font-bold mt-1.5">⚠ {cpfError}</p>}
                    </div>

                    <button onClick={handleCpfSubmit} disabled={cpfLoading}
                      className="w-full bg-[#0B6CF4] hover:bg-[#1788FF] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md"
                    >
                      {cpfLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Verificando...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Consultar CPF
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* CPF FOUND STATE */}
                {cpfResult === 'found' && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-50 border-4 border-green-500/20 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6 text-[#00C853] stroke-[3]" />
                    </div>

                    <h3 className="font-display font-bold text-lg text-gray-900 mb-1">
                      Encontramos um cadastro!
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">
                      CPF <strong className="text-gray-800">{cpfValue}</strong>
                    </p>
                    {cpfClientName && (
                      <p className="text-sm font-semibold text-[#0B6CF4] mb-4">
                        {cpfClientName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">
                      Localizamos seu cadastro em nossa base. Clique abaixo para continuar sua solicitação.
                    </p>

                    <button onClick={continueCadastro}
                      className="w-full bg-[#00C853] hover:bg-[#00b049] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md mb-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Continuar Cadastro
                    </button>
                    <button onClick={() => { setIsCpfModalOpen(false); setCpfResult('idle'); }}
                      className="text-xs font-semibold text-gray-400 hover:text-gray-600 py-2 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                )}

                {/* CPF NOT FOUND STATE */}
                {cpfResult === 'notfound' && (
                  <div className="p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 border-4 border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                      <Search className="w-6 h-6 text-amber-500" />
                    </div>

                    <h3 className="font-display font-bold text-lg text-gray-900 mb-1">
                      Não encontramos cadastro
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">
                      CPF <strong className="text-gray-800">{cpfValue}</strong>
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-6 mt-3">
                      Este CPF não possui cadastro no CredVale. Clique abaixo para assinar o CredVale e começar a economizar.
                    </p>

                    <button onClick={goToCadastro}
                      className="w-full bg-[#0B6CF4] hover:bg-[#1788FF] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md mb-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Assinar CredVale
                    </button>
                    <button onClick={() => { setCpfResult('idle'); setCpfValue(''); }}
                      className="text-xs font-semibold text-[#0B6CF4] hover:text-[#1788FF] py-2 transition-colors"
                    >
                      Tentar outro CPF
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

