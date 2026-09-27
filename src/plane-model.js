// Resolution-independent metallic aircraft, tinted by player colour.
export function planeSvg(tint){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="-26 -26 52 52">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#70899e"/><stop offset=".32" stop-color="#edf5fa"/><stop offset=".49" stop-color="#fff"/><stop offset=".65" stop-color="#dbe7ee"/><stop offset="1" stop-color="#6e889e"/></linearGradient>
    <linearGradient id="wing" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#e3edf5"/><stop offset="1" stop-color="#8196ab"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b9f4ff"/><stop offset=".4" stop-color="#4287b1"/><stop offset="1" stop-color="#102b47"/></linearGradient>
  </defs>
  <path d="M0-22 Q5-20 5-6 L22 5 L22 10 L5 5 L4 15 L11 19 L11 22 L0 19 L-11 22 L-11 19 L-4 15 L-5 5 L-22 10 L-22 5 L-5-6 Q-5-20 0-22Z" fill="#142b42" opacity=".25" transform="translate(0 2)"/>
  <g stroke="#526c83" stroke-width=".7" stroke-linejoin="round">
    <path d="M-3 11 L-12 18 L-12 21 L0 17 L12 21 L12 18 L3 11Z" fill="url(#wing)"/>
    <rect x="-12" y="0" width="4" height="10" rx="2" fill="url(#metal)"/>
    <rect x="8" y="0" width="4" height="10" rx="2" fill="url(#metal)"/>
    <path d="M-3-7 L-23 5 L-23 9 L-4 4 L0 7 L4 4 L23 9 L23 5 L3-7Z" fill="url(#wing)"/>
    <path d="M0-23 C5-21 5-12 4 1 L3 15 Q2 20 0 21 Q-2 20-3 15 L-4 1 C-5-12-5-21 0-23Z" fill="url(#metal)"/>
  </g>
  <path d="M-22 5 L-17 2 L-17 7 L-22 8Z M22 5 L17 2 L17 7 L22 8Z M-10 18 L-5 15 L-5 18 L-10 20Z M10 18 L5 15 L5 18 L10 20Z" fill="${tint}"/>
  <path d="M0-17 Q3-16 3-10 L2-6 Q0-4-2-6 L-3-10 Q-3-16 0-17Z" fill="url(#glass)" stroke="#4b657a" stroke-width=".65"/>
  <path d="M-1.5-14 Q-2-10-1-8" fill="none" stroke="#e6ffff" stroke-width="1" stroke-linecap="round" opacity=".85"/>
  <path d="M0 5 L1.8 16 L0 20 L-1.8 16Z" fill="${tint}"/>
  <path d="M-5 1 L-18 5 M5 1 L18 5" fill="none" stroke="#fff" stroke-width=".8" opacity=".8"/>
  <path d="M-3 2 L-3 10 M3 2 L3 10" fill="none" stroke="#637d93" stroke-width=".7" stroke-dasharray="1.4 1.3"/>
  </svg>`;
}
