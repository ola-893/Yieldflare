import React, { useState } from 'react';
import { UserDesignPreviewOption } from '../types';
import { FLUX_TYPOGRAPHY_SVG, XRP_VAULT_FLOW_SVG, COMPACT_VAULT_SVG, SWT_REFERENCE_SVG } from '../assets/images';
import { Check, Sparkles } from 'lucide-react';

export const DESIGN_OPTIONS: UserDesignPreviewOption[] = [
  {
    id: 'compact-vault',
    title: 'Design Preview 1: Closed Compact Vault',
    subtitle: 'Primary Vault Interaction State (Frame 0)',
    tag: 'Hero & Deposit State',
    svgContent: COMPACT_VAULT_SVG,
    description: 'Compact 3D organic twisted rope vault with glowing neon pink pipelines, side intake/outlets, and central vault lock door on #F5F5F3 background.'
  },
  {
    id: 'xrp-flow',
    title: 'Design Preview 2: XRP Process Flow & Yield Routing',
    subtitle: 'Architecture & Protocol Flow State',
    tag: 'Protocol Flow State',
    svgContent: XRP_VAULT_FLOW_SVG,
    description: 'Visual diagram showing native XRP entering the ParentVault, FAsset minting, and emerging into the auto-compounding FlareYield polyhedral pool.'
  },
  {
    id: 'flux-typography',
    title: 'Design Preview 3: FLUX Brand Typographic Artwork',
    subtitle: 'Editorial Title & Hero Branding',
    tag: 'Brand Identity',
    svgContent: FLUX_TYPOGRAPHY_SVG,
    description: 'FLUX 3D letters crafted from soft ceramic rope, glass hourglass rebalancers, and central vault doors emitting soft pink neon halo.'
  },
  {
    id: 'swt-editorial',
    title: 'Design Preview 4: SWT Minimalist Editorial Layout',
    subtitle: 'Editorial Typography & Glassmorphic UI',
    tag: 'UI Layout Grid',
    svgContent: SWT_REFERENCE_SVG,
    description: 'Minimalist editorial interface with high typographic contrast, outline typography, floating 3D organic element, and glass cards on #F5F5F3 background.'
  }
];

interface ImagePreviewSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDesignId: string;
  onSelectDesign: (id: string) => void;
}

export const ImagePreviewSelector: React.FC<ImagePreviewSelectorProps> = ({
  isOpen,
  onClose,
  selectedDesignId,
  onSelectDesign
}) => {
  const [activeTab, setActiveTab] = useState<string>(selectedDesignId || 'compact-vault');

  if (!isOpen) return null;

  const currentOption = DESIGN_OPTIONS.find(o => o.id === activeTab) || DESIGN_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#1E1E1E]/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="bg-[#F5F5F3] border border-[#1E1E1E] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Drawer Header */}
        <div className="p-6 bg-[#F5F5F3] border-b border-[#1E1E1E]/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-[#F5F5F3] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#E1BAC2]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#1E1E1E]" style={{ fontFamily: 'Manrope, sans-serif' }}>Design System Inspector</h2>
              <p className="text-xs text-[#4A4A4A] font-mono">Strict `#F5F5F3` canvas background with editorial typography</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1E1E1E] text-[#F5F5F3] hover:bg-[#000000] flex items-center justify-center font-bold transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#1E1E1E]/15 bg-[#F5F5F3] overflow-x-auto">
          {DESIGN_OPTIONS.map((opt) => {
            const isActive = opt.id === activeTab;
            return (
              <button
                key={opt.id}
                onClick={() => setActiveTab(opt.id)}
                className={`px-4 py-2 rounded-t-xl text-[11px] font-mono font-bold tracking-wider whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#1E1E1E] text-[#E1BAC2]'
                    : 'text-[#4A4A4A] hover:text-[#1E1E1E]'
                }`}
              >
                {opt.title.split(':')[0]}
              </button>
            );
          })}
        </div>

        {/* Main Preview Workspace */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#F5F5F3] grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SVG Canvas Preview Container */}
          <div className="lg:col-span-2 bg-white/60 border border-[#1E1E1E]/15 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[360px] relative group">
            <div 
              className="w-full h-full rounded-xl overflow-hidden"
              dangerouslySetInnerHTML={{ __html: currentOption.svgContent }}
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#1E1E1E] text-[#F5F5F3] text-[10px] font-mono tracking-widest uppercase">
              BG COLOR: #F5F5F3
            </div>
          </div>

          {/* Details & Selection Panel */}
          <div className="flex flex-col justify-between bg-white/70 border border-[#1E1E1E]/15 p-6 rounded-2xl">
            <div>
              <div className="inline-block px-3 py-1 rounded-full border border-[#1E1E1E]/20 text-[#1E1E1E] text-[10px] font-mono font-bold uppercase tracking-wider mb-3">
                {currentOption.tag}
              </div>

              <h3 className="text-lg font-extrabold text-[#1E1E1E] mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {currentOption.title}
              </h3>
              <p className="text-xs font-mono font-bold text-[#E1BAC2] mb-4">
                {currentOption.subtitle}
              </p>

              <p className="text-xs text-[#4A4A4A] leading-relaxed mb-6">
                {currentOption.description}
              </p>

              {/* Design Palette Token Badges */}
              <div className="mb-6 p-4 rounded-xl bg-[#F5F5F3] border border-[#1E1E1E]/15">
                <h4 className="text-[10px] font-mono font-bold text-[#1E1E1E] uppercase tracking-[0.2em] mb-2">Palette Tokens</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#F5F5F3] border border-[#1E1E1E]" />
                    <span>#F5F5F3 (Canvas)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#E1BAC2]" />
                    <span>#E1BAC2 (Accent)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#1E1E1E]" />
                    <span>#1E1E1E (Dark)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-white border border-[#1E1E1E]/20" />
                    <span>#FFFFFF (Glass)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#1E1E1E]/15">
              <button
                onClick={() => {
                  onSelectDesign(currentOption.id);
                  onClose();
                }}
                className="flex-1 py-3 rounded-full bg-[#1E1E1E] text-[#F5F5F3] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-[#000000] transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 text-[#E1BAC2]" />
                <span>Apply Design Concept</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F5F3] border-t border-[#1E1E1E]/15 flex items-center justify-between text-xs text-[#4A4A4A]">
          <span className="font-mono text-[10px] uppercase tracking-wider">Flare Network • XRP & BTC Yield Protocol</span>
          <button onClick={onClose} className="font-semibold text-[#E1BAC2] hover:underline text-xs">
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
