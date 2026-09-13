// Adapt the attributed CC BY-SA board geometry; run with the reference SVG in artifacts/references.
import fs from 'node:fs/promises';
let svg=await fs.readFile('artifacts/references/traditional-board.svg','utf8');
// Remove the reference's printed planes: actual pieces are interactive Phaser objects.
svg=svg.slice(0,svg.indexOf(' <g stroke="#000" stroke-width=".25">'))+'</svg>';
svg=svg.replace('<g transform="translate(0 -172.52)">','<g transform="rotate(90 475 475)"><g transform="translate(0 -172.52)">');
svg=svg.replace('</svg>','</g></svg>');
const replacements={'#d00':'#e7473f','#ee0':'#f4c534','#0ae':'#3289dc','#080':'#22a361','#ccc':'#f5f5ee','#eee':'#fff','#000':'#a5b1a3'};
svg=svg.replace(/#d00|#ee0|#0ae|#080|#ccc|#eee|#000/g,c=>replacements[c]);
svg=svg.replace('stroke-width="5"','stroke-width="2"');
svg=svg.replace('<metadata>','<metadata><!-- Adapted from Mliu92, Fei xing qi board (RYBG).svg, CC BY-SA 4.0. See BOARD-LICENSE.txt. -->');
await fs.writeFile('public/board.svg',svg);
