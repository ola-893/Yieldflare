/**
 * Flux Design Assets & Reference Images
 * Background Color: #F5F5F3
 */

// Image 1: FLUX Typographic 3D Vault Artwork
export const FLUX_TYPOGRAPHY_SVG = `<svg viewBox="0 0 1200 675" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF9F5" />
      <stop offset="100%" stop-color="#F5F5F3" />
    </radialGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1E1E1E" flood-opacity="0.08" />
    </filter>
    <linearGradient id="ropeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAF4F0" />
      <stop offset="50%" stop-color="#EBE3DC" />
      <stop offset="100%" stop-color="#DCD2C8" />
    </linearGradient>
    <linearGradient id="pinkNeon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#E1BAC2" />
      <stop offset="100%" stop-color="#F06292" />
    </linearGradient>
  </defs>

  <rect width="1200" height="675" fill="url(#bgGlow)" />

  <!-- Shadow under FLUX text -->
  <ellipse cx="600" cy="540" rx="480" ry="24" fill="#1E1E1E" opacity="0.06" filter="blur(10px)" />

  <!-- Letter F -->
  <g filter="url(#softShadow)" transform="translate(100, 160)">
    <!-- Back tube -->
    <path d="M 40,20 L 160,20 Q 180,20 180,40 L 180,60 Q 180,80 160,80 L 100,80 L 100,160 L 160,160 Q 180,160 180,180 L 180,200 L 100,200 L 100,280 Q 100,300 80,300 L 60,300 Q 40,300 40,280 Z" fill="url(#ropeGrad)" stroke="#E0D5CC" stroke-width="3" />
    <!-- Pink Core glow -->
    <path d="M 50,40 L 150,40 M 100,90 L 100,190" stroke="url(#pinkNeon)" stroke-width="12" stroke-linecap="round" filter="url(#neonGlow)" />
    <!-- Vault Latch on F -->
    <rect x="110" y="140" width="50" height="50" rx="8" fill="#F5F5F3" stroke="#DCD2C8" stroke-width="2" />
    <circle cx="135" cy="165" r="14" fill="none" stroke="url(#pinkNeon)" stroke-width="3" />
  </g>

  <!-- Letter L -->
  <g filter="url(#softShadow)" transform="translate(320, 160)">
    <path d="M 40,20 Q 40,0 60,0 L 80,0 Q 100,0 100,20 L 100,240 L 180,240 Q 200,240 200,260 L 200,280 Q 200,300 180,300 L 60,300 Q 40,300 40,280 Z" fill="url(#ropeGrad)" stroke="#E0D5CC" stroke-width="3" />
    <path d="M 70,30 L 70,250 L 170,250" stroke="url(#pinkNeon)" stroke-width="12" stroke-linecap="round" fill="none" filter="url(#neonGlow)" />
  </g>

  <!-- Letter U (Hourglasses + Vault) -->
  <g filter="url(#softShadow)" transform="translate(540, 160)">
    <!-- Base Curved Vault -->
    <path d="M 20,180 A 100,100 0 0,0 220,180 L 220,280 Q 220,300 200,300 L 40,300 Q 20,300 20,280 Z" fill="url(#ropeGrad)" stroke="#E0D5CC" stroke-width="3" />
    <!-- Center Vault Lock Wheel -->
    <circle cx="120" cy="210" r="45" fill="#F5F5F3" stroke="#DCD2C8" stroke-width="3" />
    <circle cx="120" cy="210" r="30" fill="none" stroke="url(#pinkNeon)" stroke-width="3" filter="url(#neonGlow)" />
    <rect x="110" y="200" width="20" height="20" rx="4" fill="url(#pinkNeon)" />

    <!-- Left Hourglass Mechanism -->
    <rect x="40" y="10" width="40" height="150" rx="10" fill="rgba(255,255,255,0.8)" stroke="#E0D5CC" stroke-width="2" />
    <path d="M 50,20 L 70,80 L 50,140" fill="none" stroke="url(#pinkNeon)" stroke-width="6" filter="url(#neonGlow)" />

    <!-- Right Hourglass Mechanism -->
    <rect x="160" y="10" width="40" height="150" rx="10" fill="rgba(255,255,255,0.8)" stroke="#E0D5CC" stroke-width="2" />
    <path d="M 170,20 L 190,80 L 170,140" fill="none" stroke="url(#pinkNeon)" stroke-width="6" filter="url(#neonGlow)" />
  </g>

  <!-- Letter X -->
  <g filter="url(#softShadow)" transform="translate(800, 160)">
    <path d="M 30,20 L 80,130 L 30,280 L 70,300 L 120,170 L 170,300 L 210,280 L 160,130 L 210,20 L 170,0 L 120,100 L 70,0 Z" fill="url(#ropeGrad)" stroke="#E0D5CC" stroke-width="3" />
    <!-- Cross glowing core -->
    <path d="M 40,30 L 120,150 L 200,270 M 200,30 L 120,150 L 40,270" stroke="url(#pinkNeon)" stroke-width="10" stroke-linecap="round" filter="url(#neonGlow)" />
    <!-- Center Vault Lock Door -->
    <rect x="90" y="120" width="60" height="60" rx="12" fill="#F5F5F3" stroke="#DCD2C8" stroke-width="2" />
    <circle cx="120" cy="150" r="16" fill="none" stroke="url(#pinkNeon)" stroke-width="3" />
  </g>
</svg>`;

// Image 2: XRP Flow & Yield Process Diagram
export const XRP_VAULT_FLOW_SVG = `<svg viewBox="0 0 1200 675" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="neonGlow2" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <linearGradient id="pinkNeon2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E1BAC2" />
      <stop offset="100%" stop-color="#FF65A3" />
    </linearGradient>
  </defs>

  <rect width="1200" height="675" fill="#F5F5F3" />

  <!-- Flow Arrow Left: XRP Logo -->
  <g transform="translate(100, 260)">
    <path d="M 20,40 L 70,0 L 120,40 L 120,70 L 70,30 L 20,70 Z M 20,100 L 70,140 L 120,100 L 120,70 L 70,110 L 20,70 Z" fill="#D8CBC4" />
    <path d="M 140,70 L 220,70" stroke="#E1BAC2" stroke-width="4" stroke-dasharray="8 6" filter="url(#neonGlow2)" />
    <polygon points="220,60 240,70 220,80" fill="#E1BAC2" />
    <text x="70" y="180" font-family="sans-serif" font-size="16" font-weight="600" fill="#A1A19A" text-anchor="middle">Native XRP Deposit</text>
  </g>

  <!-- Center Vault Shell -->
  <g transform="translate(420, 160)">
    <!-- Outer twisted rope cube casing -->
    <rect x="0" y="0" width="360" height="360" rx="60" fill="#FAF4F0" stroke="#E3D7CE" stroke-width="6" />
    <rect x="20" y="20" width="320" height="320" rx="48" fill="#F0E5DF" stroke="#DCD0C6" stroke-width="4" />
    <!-- Cutout showing glowing pink tubes inside -->
    <rect x="70" y="60" width="220" height="240" rx="30" fill="#1E1E1E" opacity="0.04" />
    <path d="M 90,100 L 270,100 M 90,180 L 270,180 M 90,260 L 270,260" stroke="url(#pinkNeon2)" stroke-width="12" stroke-linecap="round" filter="url(#neonGlow2)" />

    <!-- Front Vault Door -->
    <rect x="180" y="80" width="150" height="200" rx="20" fill="#F5F5F3" stroke="#DCD0C6" stroke-width="3" />
    <circle cx="255" cy="180" r="35" fill="none" stroke="url(#pinkNeon2)" stroke-width="4" filter="url(#neonGlow2)" />
    <!-- Interaction Hand Icon -->
    <circle cx="255" cy="180" r="14" fill="#E1BAC2" />
    <text x="180" y="340" font-family="sans-serif" font-size="16" font-weight="600" fill="#A1A19A" text-anchor="middle">ParentVault &amp; FAssets Bridge</text>
  </g>

  <!-- Right: Yield Cluster with Geometric Polyhedron -->
  <g transform="translate(860, 220)">
    <!-- Wireframe Polyhedron -->
    <polygon points="120,0 220,60 220,180 120,240 20,180 20,60" fill="none" stroke="#D8CBC4" stroke-width="1.5" stroke-dasharray="4 4" />
    <line x1="120" y1="0" x2="120" y2="240" stroke="#D8CBC4" stroke-width="1" />
    <line x1="20" y1="60" x2="220" y2="180" stroke="#D8CBC4" stroke-width="1" />
    <line x1="220" y1="60" x2="20" y2="180" stroke="#D8CBC4" stroke-width="1" />

    <!-- Floating Pink XRP Spheres -->
    <circle cx="80" cy="80" r="24" fill="url(#pinkNeon2)" opacity="0.9" filter="url(#neonGlow2)" />
    <circle cx="140" cy="60" r="20" fill="url(#pinkNeon2)" opacity="0.8" filter="url(#neonGlow2)" />
    <circle cx="160" cy="130" r="28" fill="url(#pinkNeon2)" opacity="0.95" filter="url(#neonGlow2)" />
    <circle cx="90" cy="150" r="22" fill="url(#pinkNeon2)" opacity="0.85" filter="url(#neonGlow2)" />

    <text x="120" y="270" font-family="sans-serif" font-size="16" font-weight="600" fill="#A1A19A" text-anchor="middle">Auto-Compounding FlareYield Pool</text>
  </g>
</svg>`;

// Image 3: Compact Closed Flux Vault
export const COMPACT_VAULT_SVG = `<svg viewBox="0 0 800 600" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="neonGlow3" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <linearGradient id="pinkNeon3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E1BAC2" />
      <stop offset="100%" stop-color="#F06292" />
    </linearGradient>
  </defs>

  <rect width="800" height="600" fill="#F5F5F3" />

  <!-- Shadow under Vault -->
  <ellipse cx="400" cy="510" rx="220" ry="24" fill="#1E1E1E" opacity="0.08" filter="blur(12px)" />

  <!-- Main Vault Body -->
  <g transform="translate(220, 110)">
    <!-- Twisted outer ceramic shell -->
    <rect x="0" y="0" width="360" height="360" rx="72" fill="#FAF4F0" stroke="#E3D7CE" stroke-width="8" />
    <rect x="24" y="24" width="312" height="312" rx="56" fill="#F0E5DF" stroke="#DCD0C6" stroke-width="4" />

    <!-- Left intake pipe -->
    <path d="M -50,150 C -30,130 -10,130 0,150 L 0,210 C -10,230 -30,230 -50,210 Z" fill="#E8DCD4" stroke="#DCD0C6" stroke-width="3" />
    <ellipse cx="-50" cy="180" rx="12" ry="30" fill="#E1BAC2" opacity="0.8" filter="url(#neonGlow3)" />

    <!-- Right outlet pipe -->
    <path d="M 360,150 C 370,130 390,130 410,150 L 410,210 C 390,230 370,230 360,210 Z" fill="#E8DCD4" stroke="#DCD0C6" stroke-width="3" />
    <ellipse cx="410" cy="180" rx="12" ry="30" fill="#E1BAC2" opacity="0.8" filter="url(#neonGlow3)" />

    <!-- Internal side cutout showing glowing pink tubes -->
    <rect x="40" y="60" width="100" height="240" rx="20" fill="#A1A19A" opacity="0.05" />
    <path d="M 60,90 L 120,90 M 60,180 L 120,180 M 60,270 L 120,270" stroke="url(#pinkNeon3)" stroke-width="10" stroke-linecap="round" filter="url(#neonGlow3)" />

    <!-- Front Vault Door -->
    <rect x="150" y="60" width="170" height="240" rx="28" fill="#F5F5F3" stroke="#DCD0C6" stroke-width="4" />
    <circle cx="235" cy="180" r="45" fill="none" stroke="url(#pinkNeon3)" stroke-width="5" filter="url(#neonGlow3)" />
    <!-- Lock Icon -->
    <rect x="223" y="170" width="24" height="20" rx="4" fill="url(#pinkNeon3)" />
    <path d="M 229,170 A 6,6 0 0,1 241,170" fill="none" stroke="url(#pinkNeon3)" stroke-width="3" />
  </g>
</svg>`;

// Image 4: Minimalist Editorial Reference (SWT Aesthetic)
export const SWT_REFERENCE_SVG = `<svg viewBox="0 0 1000 700" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sphereGrad" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#E8C5E5" />
      <stop offset="50%" stop-color="#C5A1D4" />
      <stop offset="100%" stop-color="#8E6A9E" />
    </radialGradient>
  </defs>

  <rect width="1000" height="700" fill="#F5F5F3" />

  <!-- Header -->
  <text x="60" y="60" font-family="sans-serif" font-size="20" font-weight="700" fill="#1E1E1E">FLUX</text>
  <text x="900" y="60" font-family="sans-serif" font-size="14" font-weight="500" fill="#1E1E1E">Protocol Docs</text>

  <!-- Big Background Outlined Typography -->
  <text x="500" y="320" font-family="sans-serif" font-size="160" font-weight="900" fill="none" stroke="#D8CBC4" stroke-width="2" text-anchor="middle" letter-spacing="20">S W E E T Y</text>

  <!-- White Glassmorphic Card -->
  <rect x="150" y="240" width="700" height="380" rx="32" fill="rgba(255,255,255,0.75)" stroke="rgba(216,203,196,0.5)" stroke-width="1.5" />

  <!-- Floating 3D Organic Petal Sphere -->
  <circle cx="500" cy="300" r="140" fill="url(#sphereGrad)" filter="drop-shadow(0 20px 30px rgba(142,106,158,0.25))" />

  <!-- Button in Card -->
  <rect x="420" y="520" width="160" height="48" rx="24" fill="none" stroke="#1E1E1E" stroke-width="1.5" />
  <text x="500" y="550" font-family="sans-serif" font-size="14" font-weight="600" fill="#1E1E1E" text-anchor="middle">Check More</text>
</svg>`;
