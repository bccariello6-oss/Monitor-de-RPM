import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Settings, RefreshCw, Download, Factory, Gauge, Info, ChevronDown, ChevronUp, Layout, Calculator, ZoomIn, ZoomOut, Maximize, Search, Upload, MousePointer2, CheckCircle2, XCircle, Trash2, Crosshair, Target } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { GROUPS, DEFAULT_PARAMS, MACHINE_DRAWING_URL } from './constants';
import { TransmissionParams, GroupInput, ComponentType, MechanicalComponent, GroupData } from './types';
import { supabase } from './supabase';
import { Auth } from './Auth';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuth={() => { }} />;
  }

  return <MainApp session={session} />;
};

const MainApp: React.FC<{ session: Session }> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'calc' | 'vision'>('calc');
  const [params, setParams] = useState<TransmissionParams>(DEFAULT_PARAMS);
  const [groupInputs, setGroupInputs] = useState<GroupInput[]>(GROUPS.map(g => ({ id: g.id, inputRPM: 0 })));
  const [customMarkers, setCustomMarkers] = useState<Record<string, { x: number; y: number; manualRPM?: number }>>({});
  const [viewState, setViewState] = useState({ zoom: 1, offset: { x: 0, y: 0 } });
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Fetch from Cloud on mount
  useEffect(() => {
    const fetchState = async () => {
      const { data, error } = await supabase
        .from('user_states')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (data) {
        if (data.active_tab) setActiveTab(data.active_tab as any);
        if (data.calc_params) setParams(data.calc_params as any);
        if (data.group_inputs) setGroupInputs(data.group_inputs as any);
        if (data.custom_markers) setCustomMarkers(data.custom_markers as any);
        if (data.view_state) setViewState(data.view_state as any);
        if (data.drawing_url) setDrawingUrl(data.drawing_url);
      } else if (error && error.code === 'PGRST116') {
        // No record yet, create it
        await supabase.from('user_states').insert({ user_id: session.user.id });
      }
    };
    fetchState();
  }, [session.user.id]);

  // Unified debounced Cloud Save
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsCloudSyncing(true);
      await supabase.from('user_states').upsert({
        user_id: session.user.id,
        active_tab: activeTab,
        calc_params: params,
        group_inputs: groupInputs,
        custom_markers: customMarkers,
        view_state: viewState,
        drawing_url: drawingUrl,
        updated_at: new Date().toISOString()
      });
      setIsCloudSyncing(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [session.user.id, activeTab, params, groupInputs, customMarkers, viewState, drawingUrl]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map(g => [g.id, true]))
  );

  const handleParamChange = (key: keyof TransmissionParams, value: string) => {
    const numValue = parseFloat(value) || 0;
    setParams(prev => ({ ...prev, [key]: numValue }));
  };

  const handleGroupRPMChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setGroupInputs(prev =>
      prev.map(input => (input.id === id ? { ...input, inputRPM: numValue } : input))
    );
  };

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateRPM = useCallback((
    type: ComponentType,
    entryRPM: number,
    p: TransmissionParams
  ) => {
    const rpmSec = entryRPM * (p.rodete / p.engrenagemSecador);
    if (type === 'SEC') return rpmSec;
    if (type === 'RSO') return rpmSec * (p.engrenagemSecador / p.soprador);
    if (type === 'CG') return rpmSec * (p.engrenagemSecador / p.cilindroGuia);
    return 0;
  }, []);

  const resetAll = () => {
    if (confirm('Deseja resetar todos os par├ómetros da calculadora e voltar para a estaca zero?')) {
      setParams(DEFAULT_PARAMS);
      setGroupInputs(GROUPS.map(g => ({ id: g.id, inputRPM: 0 })));
      setCollapsedGroups(Object.fromEntries(GROUPS.map(g => [g.id, true])));
      localStorage.removeItem('rpm_monitor_calc_params');
      localStorage.removeItem('rpm_monitor_calc_group_inputs');
    }
  };

  const exportToCSV = () => {
    const rows = [['Monitor de RPM SWM BRASIL - Engenharia e Confiabilidade'], ['Parametros'], ['Rodete', params.rodete], ['Engr. Secador', params.engrenagemSecador], ['Soprador', params.soprador], ['Cilindro Guia', params.cilindroGuia], [], ['Grupo', 'Posicao', 'Tipo', 'RPM Entrada', 'RPM Calculado']];
    GROUPS.forEach(group => {
      const entryRPM = groupInputs.find(i => i.id === group.id)?.inputRPM || 0;
      group.components.forEach(comp => {
        const calculated = calculateRPM(comp.type, entryRPM, params);
        rows.push([group.name, comp.id, comp.type, entryRPM.toString(), calculated.toFixed(2)]);
      });
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RPM_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <style>{`
        @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-rotate { animation: rotate-slow 3s linear infinite; }
        .vision-canvas-container { height: calc(100vh - 280px); }
        .drawing-wrapper { touch-action: none; }
        .marker-anim { transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .marker-anim:hover { transform: scale(1.4); z-index: 50; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes target-ping {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .animate-target-ping { animation: target-ping 1.5s ease-out infinite; }
      `}</style>

      <header className="bg-white shadow-md border-b border-slate-200 shrink-0">
        <div className="max-w-[100%] mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-sm"><Factory className="text-white w-5 h-5" /></div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-none mb-0.5">Monitor de RPM SWM BRASIL</h1>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.15em] leading-none">Engenharia e Confiabilidade</span>
                  {isCloudSyncing ? (
                    <span className="text-[8px] text-blue-500 font-bold animate-pulse flex items-center gap-1">
                      <RefreshCw size={8} className="animate-spin" /> SINCRONIZANDO NUVEM...
                    </span>
                  ) : (
                    <span className="text-[8px] text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 size={8} /> SINCRONIZADO
                    </span>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button onClick={() => setActiveTab('calc')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'calc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Calculator size={14} /> Calculadora
              </button>
              <button onClick={() => setActiveTab('vision')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'vision' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Layout size={14} /> Vis├úo de M├íquina
              </button>
            </nav>

            <div className="flex gap-2">
              <button onClick={resetAll} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md border border-slate-300"><RefreshCw size={14} /></button>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium shadow-sm transition-colors"><Download size={14} /> Exportar</button>
            </div>
          </div>

          {activeTab === 'calc' && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="grid grid-cols-4 gap-4">
                <ParameterInput label="Rodete" value={params.rodete} onChange={(v) => handleParamChange('rodete', v)} />
                <ParameterInput label="Engr. Sec." value={params.engrenagemSecador} onChange={(v) => handleParamChange('engrenagemSecador', v)} />
                <ParameterInput label="Soprador" value={params.soprador} onChange={(v) => handleParamChange('soprador', v)} />
                <ParameterInput label="Cil. Guia" value={params.cilindroGuia} onChange={(v) => handleParamChange('cilindroGuia', v)} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className={`flex-1 overflow-auto p-4 ${activeTab === 'vision' ? 'overflow-hidden flex flex-col' : ''}`}>
        {activeTab === 'calc' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-7xl mx-auto pb-8">
            {GROUPS.map((group) => {
              const groupInput = groupInputs.find(i => i.id === group.id);
              const isCollapsed = collapsedGroups[group.id] ?? true;
              return (
                <GroupCard
                  key={group.id}
                  group={group as GroupData}
                  entryRPM={groupInput?.inputRPM || 0}
                  params={params}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(group.id)}
                  onRPMChange={(v) => handleGroupRPMChange(group.id, v)}
                  calculateFn={calculateRPM}
                />
              );
            })}
          </div>
        ) : (
          <InteractiveMachineVision
            session={session}
            groups={GROUPS}
            groupInputs={groupInputs}
            params={params}
            calculateFn={calculateRPM}
            onRPMChange={handleGroupRPMChange}
            customMarkers={customMarkers}
            setCustomMarkers={setCustomMarkers}
            viewState={viewState}
            setViewState={setViewState}
            drawingUrl={drawingUrl}
            setDrawingUrl={setDrawingUrl}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-2 px-4 shrink-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Sess├úo: {session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} className="text-red-500 hover:text-red-700 font-black transition-colors">SAIR</button>
          </div>
          <span>SWM BRASIL &copy; 2026</span>
        </div>
      </footer>
    </div>
  );
};

// --- Interactive Machine Vision ---

const InteractiveMachineVision: React.FC<{
  session: Session;
  groups: typeof GROUPS;
  groupInputs: GroupInput[];
  params: TransmissionParams;
  calculateFn: (type: ComponentType, entryRPM: number, p: TransmissionParams) => number;
  onRPMChange: (id: string, value: string) => void;
  customMarkers: Record<string, { x: number; y: number; manualRPM?: number }>;
  setCustomMarkers: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number; manualRPM?: number }>>>;
  viewState: { zoom: number; offset: { x: number; y: number } };
  setViewState: React.Dispatch<React.SetStateAction<{ zoom: number, offset: { x: number, y: number } }>>;
  drawingUrl: string | null;
  setDrawingUrl: React.Dispatch<React.SetStateAction<string | null>>;
}> = ({
  session,
  groups,
  groupInputs,
  params,
  calculateFn,
  onRPMChange,
  customMarkers,
  setCustomMarkers,
  viewState,
  setViewState,
  drawingUrl,
  setDrawingUrl
}) => {
    const { zoom, offset } = viewState;
    const setZoom = (newZoom: number | ((z: number) => number)) => {
      setViewState(prev => ({
        ...prev,
        zoom: typeof newZoom === 'function' ? newZoom(prev.zoom) : newZoom
      }));
    };
    const setOffset = (newOffset: { x: number, y: number } | ((o: { x: number, y: number }) => number)) => {
      setViewState(prev => ({
        ...prev,
        offset: typeof newOffset === 'function' ? (newOffset as any)(prev.offset) : newOffset
      }));
    };

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [isImageLoading, setIsImageLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [placingMarker, setPlacingMarker] = useState<{ x: number, y: number } | null>(null);
    const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsImageLoading(true);
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${session.user.id}/${Math.random()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('user-drawings')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('user-drawings')
            .getPublicUrl(filePath);

          setDrawingUrl(publicUrl);
          setZoom(1);
          setOffset({ x: 0, y: 0 });
        } catch (err: any) {
          console.error('Error uploading to Supabase Storage:', err);
          alert('Erro ao fazer upload: ' + err.message);
        } finally {
          setIsImageLoading(false);
        }
      }
    };

    const filteredComponentsForDropdown = useMemo(() => {
      return groups.map(g => ({
        ...g,
        components: g.components.filter(c =>
          c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(g => g.components.length > 0);
    }, [groups, searchTerm]);

    const allComponents = useMemo(() =>
      groups.flatMap(g => g.components.map(c => ({ ...c, groupId: g.id, groupName: g.name }))),
      [groups]
    );

    const handleMouseDown = (e: React.MouseEvent) => {
      if (isEditMode && !e.shiftKey) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (draggingMarkerId && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Clamp values between 0 and 100
        const clampedX = Math.max(0, Math.min(100, x));
        const clampedY = Math.max(0, Math.min(100, y));

        setCustomMarkers(prev => ({
          ...prev,
          [draggingMarkerId]: { ...prev[draggingMarkerId], x: clampedX, y: clampedY }
        }));
        return;
      }

      if (!isDragging) return;
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggingMarkerId(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
      const delta = e.deltaY * -0.001;
      const newZoom = Math.min(Math.max(zoom + delta, 0.05), 20);
      setZoom(newZoom);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
      if (!isEditMode || !imageRef.current || !containerRef.current || isImageLoading) return;

      const rect = imageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setPlacingMarker({ x, y });
      setSearchTerm('');
    };

    const assignComponent = (compId: string, manualRPM?: number) => {
      if (!placingMarker) return;
      setCustomMarkers(prev => ({
        ...prev,
        [compId]: { ...placingMarker, manualRPM }
      }));
      setPlacingMarker(null);
    };

    const updateMarkerRPM = (compId: string, manualRPM: number | undefined) => {
      setCustomMarkers(prev => {
        if (!prev[compId]) return prev;
        return {
          ...prev,
          [compId]: { ...prev[compId], manualRPM }
        };
      });
    };

    const removeMarker = (compId: string) => {
      const newMarkers = { ...customMarkers };
      delete newMarkers[compId];
      setCustomMarkers(newMarkers);
    };

    const resetView = () => {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPlacingMarker(null);
    };

    const toggleFullScreen = () => {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    };

    return (
      <div className="vision-canvas-container flex flex-col bg-slate-100 rounded-3xl shadow-2xl border border-slate-200 relative flex-1 overflow-hidden transition-all duration-300">

        {/* --- Vision Header Bar --- */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-3 flex items-center justify-between z-50 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
              disabled={isImageLoading}
            >
              <Upload size={14} strokeWidth={2.5} className="group-hover:translate-y-[-1px] transition-transform" />
              Importar Desenho
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleImageUpload} className="hidden" />

            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setPlacingMarker(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 ${isEditMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {isEditMode ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <MousePointer2 size={14} strokeWidth={2.5} />}
              {isEditMode ? 'Concluir Mapeamento' : 'Mapear Ativos'}
            </button>
          </div>

          <div className="flex items-center gap-6 bg-slate-50/50 px-5 py-2 rounded-2xl border border-slate-200/60 shadow-inner">
            <div className="flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista MP06</h3>
              <div className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black shadow-sm">{Object.keys(customMarkers).length} ATIVOS</div>
            </div>
            <div className="flex gap-4">
              <LegendItem color="bg-indigo-500" label="Secadores" />
              <LegendItem color="bg-cyan-400" label="Sopradores" />
              <LegendItem color="bg-slate-400" label="Cil. Guia" />
            </div>
          </div>
        </div>

        {/* --- Vision Body (Drawing) --- */}
        <div
          ref={containerRef}
          className={`flex-1 w-full bg-slate-50/50 overflow-hidden relative select-none drawing-wrapper ${isEditMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
        >
          {isEditMode && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] bg-amber-500 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border border-amber-400/50 animate-bounce pointer-events-none">
              Clique no desenho para adicionar pontos de medi├º├úo
            </div>
          )}
          <div
            className="absolute origin-top-left transition-transform duration-100 ease-out"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          >
            <div className="relative inline-block min-w-max">
              {drawingUrl ? (
                drawingUrl.toLowerCase().endsWith('.pdf') ? (
                  <div ref={imageRef as any} className="shadow-2xl inline-block">
                    <Document
                      file={drawingUrl}
                      loading={
                        <div className="w-[800px] h-[600px] flex items-center justify-center bg-slate-100">
                          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      }
                      onLoadSuccess={() => setIsImageLoading(false)}
                      onLoadError={(error) => {
                        console.error('Error loading PDF:', error);
                        setDrawingUrl(null);
                        setIsImageLoading(false);
                      }}
                    >
                      <Page
                        pageNumber={1}
                        width={1200}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>
                  </div>
                ) : (
                  <img
                    ref={imageRef as any}
                    src={drawingUrl}
                    alt="Technical Drawing"
                    className={`w-auto block shadow-2xl transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                    style={{ maxHeight: '10000px' }}
                    draggable={false}
                    onLoad={() => setIsImageLoading(false)}
                    onError={() => {
                      setDrawingUrl(null);
                      setIsImageLoading(false);
                    }}
                  />
                )
              ) : (
                <div className="w-[1200px] h-[700px] bg-white flex items-center justify-center border-4 border-dashed border-slate-200 rounded-[3rem] m-20 shadow-inner">
                  <div className="text-center px-12">
                    <div className="bg-slate-100 p-10 rounded-[2.5rem] shadow-xl inline-block mb-8 border border-slate-200">
                      {isImageLoading ? (
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Upload size={64} className="text-blue-500 animate-pulse" />
                      )}
                    </div>
                    <h3 className="text-slate-800 font-black uppercase text-3xl tracking-tight mb-4">
                      {isImageLoading ? 'Processando Imagem...' : 'Nenhum Desenho Importado'}
                    </h3>
                    <p className="text-slate-500 text-lg font-medium max-w-md mx-auto mb-10 leading-relaxed">
                      {isImageLoading ? 'Aguarde enquanto carregamos o seu projeto.' : 'Importe a planta t├®cnica da m├íquina para iniciar o mapeamento digital dos componentes.'}
                    </p>
                    {!isImageLoading && (
                      <div className="flex flex-col gap-4 items-center">
                        <button
                          onClick={() => setDrawingUrl(MACHINE_DRAWING_URL)}
                          className="text-slate-400 hover:text-blue-600 font-bold text-sm transition-colors flex items-center gap-2"
                        >
                          <Layout size={16} />
                          Usar Desenho de Exemplo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Permanent Markers */}
              {allComponents.map(comp => {
                const entryRPM = groupInputs.find(i => i.id === comp.groupId)?.inputRPM || 0;
                const rpm = calculateFn(comp.type, entryRPM, params);
                const pos = customMarkers[comp.id];
                if (!pos) return null;

                return (
                  <Marker
                    key={comp.id}
                    comp={comp}
                    rpm={rpm}
                    pos={pos}
                    zoom={zoom}
                    isEditMode={isEditMode}
                    onRemove={() => removeMarker(comp.id)}
                    onUpdateRPM={(val) => updateMarkerRPM(comp.id, val)}
                    onDragStart={(id) => {
                      setDraggingMarkerId(id);
                      setIsEditMode(true);
                    }}
                    isDragging={draggingMarkerId === comp.id}
                  />
                );
              })}

              {/* Temporary Placement Marker & Selection UI */}
              {placingMarker && (
                <React.Fragment>
                  <div
                    className="absolute z-50 pointer-events-none"
                    style={{
                      left: `${placingMarker.x}%`,
                      top: `${placingMarker.y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / zoom})`
                    }}
                  >
                    <div className="relative flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-500 animate-target-ping absolute"></div>
                      <Target size={24} className="text-amber-500 drop-shadow-lg" />
                    </div>
                  </div>

                  <div
                    className="absolute z-[100] bg-white border border-slate-200 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] w-[280px] p-1.5 animate-in fade-in zoom-in-95 duration-200 mt-4"
                    style={{
                      left: `${placingMarker.x}%`,
                      top: `${placingMarker.y}%`,
                      transform: `scale(${1 / zoom})`,
                      transformOrigin: 'top left'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center mb-1.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Vincular</span>
                        <span className="text-[9px] text-blue-600 font-bold leading-tight">{placingMarker.x.toFixed(1)}%, {placingMarker.y.toFixed(1)}%</span>
                      </div>
                      <button onClick={() => setPlacingMarker(null)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"><XCircle size={16} /></button>
                    </div>

                    <div className="px-1.5 mb-1.5">
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/10">
                        <Search size={12} className="text-slate-400 mr-2" />
                        <input
                          type="text"
                          placeholder="ID ou Grupo..."
                          className="bg-transparent text-[11px] font-bold w-full outline-none"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-0.5 p-0.5" onWheel={(e) => e.stopPropagation()}>
                      <style>{`
                      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                    `}</style>
                      {filteredComponentsForDropdown.map(g => (
                        <div key={g.id} className="mb-4 last:mb-0">
                          <div className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase mb-2 tracking-widest shadow-sm">{g.name}</div>
                          <div className="grid grid-cols-1 gap-1">
                            {g.components.map(c => {
                              const isAlreadyPlaced = !!customMarkers[c.id];
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => assignComponent(c.id)}
                                  className={`
                                  group/btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all
                                  ${isAlreadyPlaced ? 'opacity-30 cursor-not-allowed bg-slate-50/50 grayscale' : 'hover:bg-blue-600 hover:text-white hover:shadow-md active:scale-95'}
                                `}
                                  disabled={isAlreadyPlaced}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black tracking-tight leading-none mb-0.5">{c.id}</span>
                                    <span className={`text-[8px] font-bold uppercase tracking-widest ${isAlreadyPlaced ? 'text-slate-400' : 'text-slate-500 group-hover/btn:text-blue-100'}`}>{c.type}</span>
                                  </div>
                                  {isAlreadyPlaced ? (
                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                  ) : (
                                    <div className="opacity-0 group-hover/btn:opacity-100 transition-opacity"><PlusCircle size={14} /></div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {filteredComponentsForDropdown.length === 0 && (
                        <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase italic">Nenhum componente dispon├¡vel</div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>
        </div>

        {/* --- Vision Footer Bar --- */}
        <div className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between z-50 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <div className="flex bg-slate-100/80 backdrop-blur rounded-2xl border border-slate-200/60 p-1 shadow-inner">
            <button onClick={() => setZoom(z => Math.max(z / 1.3, 0.05))} className="p-2 hover:bg-white hover:text-blue-600 text-slate-500 rounded-xl transition-all hover:shadow-sm" title="Zoom Out"><ZoomOut size={16} /></button>

            <div className="flex items-center px-4 border-x border-slate-200 text-slate-800 font-mono font-black text-xs min-w-[80px] justify-center">
              {Math.round(zoom * 100)}%
            </div>

            <button onClick={() => setZoom(z => Math.min(z * 1.3, 20))} className="p-2 hover:bg-white hover:text-blue-600 text-slate-500 rounded-xl transition-all hover:shadow-sm" title="Zoom In"><ZoomIn size={16} /></button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={resetView} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all border border-slate-200 shadow-sm" title="Ajustar ao centro"><Maximize size={14} /> Resetar Visual</button>

            <div className="w-[1px] h-6 bg-slate-200 mx-2" />

            <button onClick={toggleFullScreen} className="p-2.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-xl transition-all border border-slate-200 shadow-sm group" title="Tela Cheia">
              <Layout size={18} className="group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={() => {
                if (confirm('Deseja remover todas as marca├º├Áes?')) {
                  setCustomMarkers({});
                  localStorage.removeItem('rpm_monitor_markers');
                }
              }}
              className="p-2.5 bg-slate-100 hover:bg-red-600 hover:text-white text-red-500 rounded-xl transition-all border border-slate-200 shadow-sm group"
              title="Limpar todas as marca├º├Áes"
            >
              <Trash2 size={18} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  };

const PlusCircle: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
);

// --- High Contrast Marker Component ---

interface MarkerProps {
  comp: MechanicalComponent;
  rpm: number;
  pos: { x: number; y: number; manualRPM?: number };
  zoom: number;
  isEditMode: boolean;
  onRemove: () => void;
  onUpdateRPM: (val: number | undefined) => void;
  onDragStart: (id: string) => void;
  isDragging: boolean;
}

const Marker: React.FC<MarkerProps> = ({ comp, rpm, pos, zoom, isEditMode, onRemove, onUpdateRPM, onDragStart, isDragging }) => {
  const displayRPM = pos.manualRPM !== undefined ? pos.manualRPM : rpm;
  const isMoving = displayRPM > 0;

  const colors = {
    SEC: 'bg-indigo-600 ring-indigo-200 border-indigo-100',
    RSO: 'bg-cyan-500 ring-cyan-100 border-cyan-100',
    CG: 'bg-slate-800 ring-slate-200 border-slate-700'
  };

  return (
    <div
      className={`absolute marker-anim group/marker z-20 ${isDragging ? 'z-[100]' : ''}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(-50%, -50%) scale(${(isDragging ? 1.5 : 1) / zoom})`,
        filter: isDragging ? 'drop-shadow(0 0 20px rgba(0,0,0,0.3))' : 'none'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart(comp.id);
      }}
    >
      <div
        className={`
            w-8 h-8 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all relative
            ${colors[comp.type]} ${isMoving ? 'animate-pulse ring-8' : 'opacity-90 scale-90'}
            hover:scale-125 cursor-grab active:cursor-grabbing
            ${isDragging ? 'scale-110 ring-4 ring-white' : ''}
        `}
      >
        {isMoving ? (
          <div className="w-3 h-3 bg-white rounded-full animate-ping shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
        ) : (
          <div className="w-2 h-2 bg-white/40 rounded-full" />
        )}

        {isEditMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-4 -right-4 bg-red-600 text-white rounded-full p-2 shadow-2xl hover:bg-red-700 transition-all opacity-0 group-hover/marker:opacity-100 scale-0 group-hover/marker:scale-100"
          >
            <Trash2 size={12} strokeWidth={3} />
          </button>
        )}
      </div>

      {!isEditMode && (
        <div
          className="absolute pointer-events-none transition-all bottom-full mb-6 left-1/2 bg-slate-900/95 backdrop-blur-xl text-white text-[10px] rounded-[1.5rem] px-5 py-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)] border border-white/10 min-w-[200px] z-50 origin-bottom"
          style={{ transform: `translateX(-50%)`, opacity: 'var(--tooltip-opacity, 0)' }}
        >
          <style>{`.group\\/marker:hover .absolute { --tooltip-opacity: 1; }`}</style>
          <div className="font-black text-blue-400 border-b border-white/10 mb-3 pb-2.5 flex justify-between items-center gap-4">
            <span className="tracking-tight text-xs">{comp.id}</span>
            <span className="bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">{comp.type}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center group/rpm">
              <span className="text-slate-500 font-black uppercase text-[9px] tracking-widest">RPM Real</span>
              <div className="flex items-center gap-2 pointer-events-auto">
                <input
                  type="number"
                  step="any"
                  value={displayRPM.toFixed(2)}
                  className="bg-transparent text-emerald-400 font-mono font-black text-sm w-20 text-right outline-none hover:bg-white/5 rounded px-1 transition-colors border border-transparent hover:border-white/10"
                  onChange={(e) => onUpdateRPM(e.target.value ? parseFloat(e.target.value) : undefined)}
                  title="Clique para sobrescrever Manualmente"
                />
              </div>
            </div>
            {pos.manualRPM !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-amber-500 font-black uppercase text-[7px] tracking-widest">Sobrescrito Manualmente</span>
                <button
                  onClick={() => onUpdateRPM(undefined)}
                  className="pointer-events-auto text-[7px] font-black text-amber-500/60 hover:text-amber-500 uppercase flex items-center gap-1"
                >
                  <RefreshCw size={8} /> Resetar
                </button>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-black uppercase text-[9px] tracking-widest">Coordenadas</span>
              <span className="text-slate-400 text-[9px] font-mono font-bold">{pos.x.toFixed(1)}% / {pos.y.toFixed(1)}%</span>
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[10px] border-x-transparent border-t-[10px] border-t-slate-900/95"></div>
        </div>
      )}

      {isEditMode && (
        <div
          className="absolute top-full mt-4 left-1/2 bg-white border border-slate-200 rounded-xl p-2 shadow-xl z-50 origin-top"
          style={{ transform: `translateX(-50%)` }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">RPM Manual (Opcional)</label>
            <div className="flex gap-1">
              <input
                type="number"
                className="w-16 text-[10px] font-bold border rounded px-1"
                placeholder="Auto"
                value={pos.manualRPM ?? ''}
                onChange={e => onUpdateRPM(e.target.value ? parseFloat(e.target.value) : undefined)}
              />
              {pos.manualRPM !== undefined && (
                <button
                  onClick={() => onUpdateRPM(undefined)}
                  className="text-[8px] bg-slate-100 px-1 rounded hover:bg-slate-200"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ParameterInputProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

const ParameterInput: React.FC<ParameterInputProps> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-0.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input type="number" step="any" value={value === 0 ? '' : value} onChange={(e) => onChange(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-800 font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" />
  </div>
);

interface GroupCardProps {
  group: GroupData;
  entryRPM: number;
  params: TransmissionParams;
  isCollapsed: boolean;
  onToggle: () => void;
  onRPMChange: (value: string) => void;
  calculateFn: (type: ComponentType, entryRPM: number, p: TransmissionParams) => number;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, entryRPM, params, isCollapsed, onToggle, onRPMChange, calculateFn }) => {
  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-xl">
      <div className="bg-slate-900 p-6 flex items-center justify-between cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <div className={`p-2 bg-white/10 rounded-xl transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`}><ChevronDown size={20} className="text-slate-400" /></div>
          <h3 className="text-white font-black text-base tracking-tight uppercase">{group.name}</h3>
        </div>
        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
          <Gauge size={20} className="text-blue-400" />
          <input type="number" value={entryRPM === 0 ? '' : entryRPM} onChange={(e) => onRPMChange(e.target.value)} className="bg-transparent text-white font-mono font-black w-24 text-lg outline-none text-center" placeholder="0.00" />
        </div>
      </div>
      {!isCollapsed && (
        <div className="p-0 animate-in slide-in-from-top-4 duration-500">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200"><th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Componente</th><th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo</th><th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">RPM Real</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {group.components.map((comp) => {
                const rpm = calculateFn(comp.type, entryRPM, params);
                return (
                  <tr key={comp.id} className="hover:bg-blue-50/30 group/row transition-all duration-200">
                    <td className="px-8 py-5 text-sm font-black text-slate-800 tracking-tight">{comp.id}</td>
                    <td className="px-8 py-5"><Badge type={comp.type} /></td>
                    <td className="px-8 py-5 text-right"><span className={`text-base font-mono font-black px-4 py-1.5 rounded-xl transition-all ${rpm > 0 ? 'text-blue-700 bg-blue-100/50 ring-1 ring-blue-200 shadow-sm' : 'text-slate-300'}`}>{rpm.toFixed(2)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Badge: React.FC<{ type: ComponentType }> = ({ type }) => {
  const styles = { SEC: 'bg-indigo-100 text-indigo-700 ring-indigo-200', RSO: 'bg-cyan-100 text-cyan-700 ring-cyan-200', CG: 'bg-slate-100 text-slate-600 ring-slate-200' };
  return <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase ring-1 ring-inset tracking-widest ${styles[type]}`}>{type}</span>;
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-3">
    <div className={`w-3.5 h-3.5 rounded-full ${color} shadow-[0_0_10px_rgba(255,255,255,0.1)] ring-2 ring-white/20 ring-offset-2 ring-offset-slate-900`}></div>
    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default App;
