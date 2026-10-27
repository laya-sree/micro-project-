/* ═══════════════════════════════════════════════════════════════
   MiniCPU Studio  –  app.js
   Pipeline: Editor → DFA Tokenizer → Assembler → Huffman → CPU
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1.  INSTRUCTION SET DEFINITION
   ───────────────────────────────────────────────────────────── */
const OPCODES = {
  LOAD:  { code: 0b0000, fmt: 'RD_IMM',  desc: 'Load immediate value into register' },
  STORE: { code: 0b0001, fmt: 'RS_MEM',  desc: 'Store register value into memory address' },
  ADD:   { code: 0b0010, fmt: 'RD_RS',   desc: 'Add two registers, result in RD' },
  SUB:   { code: 0b0011, fmt: 'RD_RS',   desc: 'Subtract RS from RD, result in RD' },
  MUL:   { code: 0b0100, fmt: 'RD_RS',   desc: 'Multiply RD by RS, result in RD' },
  AND:   { code: 0b0101, fmt: 'RD_RS',   desc: 'Bitwise AND of RD and RS' },
  OR:    { code: 0b0110, fmt: 'RD_RS',   desc: 'Bitwise OR of RD and RS' },
  JMP:   { code: 0b0111, fmt: 'LABEL',   desc: 'Unconditional jump to address/label' },
  JZ:    { code: 0b1000, fmt: 'RD_LABEL',desc: 'Jump to label if RD == 0 (uses ZF)' },
  HALT:  { code: 0b1001, fmt: 'NONE',    desc: 'Stop execution' },
  LOADI: { code: 0b1010, fmt: 'RD_MEM',  desc: 'Load value from memory address into register' },
};

const INSTRUCTION_HELP = [
  { mnem:'LOAD  Rd, #imm', syntax:'LOAD R1, 42',    desc:'Load 8-bit immediate into Rd' },
  { mnem:'LOADI Rd, addr', syntax:'LOADI R1, 5',    desc:'Load value at memory[addr] into Rd' },
  { mnem:'STORE Rs, addr', syntax:'STORE R1, 10',   desc:'Write Rs value to memory[addr]' },
  { mnem:'ADD   Rd, Rs',   syntax:'ADD R1, R2',     desc:'Rd = Rd + Rs; sets ZF if result=0' },
  { mnem:'SUB   Rd, Rs',   syntax:'SUB R1, R2',     desc:'Rd = Rd − Rs; sets ZF if result=0' },
  { mnem:'MUL   Rd, Rs',   syntax:'MUL R1, R2',     desc:'Rd = Rd × Rs (8-bit result)' },
  { mnem:'AND   Rd, Rs',   syntax:'AND R1, R2',     desc:'Rd = Rd & Rs (bitwise)' },
  { mnem:'OR    Rd, Rs',   syntax:'OR  R1, R2',     desc:'Rd = Rd | Rs (bitwise)' },
  { mnem:'JMP   label',    syntax:'JMP LOOP',       desc:'PC = label address' },
  { mnem:'JZ    Rd, label',syntax:'JZ  R1, DONE',   desc:'If Rd==0 (or ZF=1), jump to label' },
  { mnem:'HALT',           syntax:'HALT',           desc:'Stop the CPU' },
];

/* ─────────────────────────────────────────────────────────────
   2.  DFA TOKENIZER
   ───────────────────────────────────────────────────────────── */
// Token types
const TT = {
  OPCODE: 'OPCODE', REGISTER: 'REGISTER', NUMBER: 'NUMBER',
  LABEL: 'LABEL', LABEL_DEF: 'LABEL_DEF', COMMA: 'COMMA',
  COMMENT: 'COMMENT', UNKNOWN: 'UNKNOWN'
};

// DFA States
const DFA_STATES = {
  S0:   'S0_START',
  OPCD: 'S1_OPCODE',
  REG_R:'S2_REG_R',
  REG_D:'S3_REG_DIGIT',
  NUM:  'S4_NUMBER',
  ALPH: 'S5_ALPHA',
  CMT:  'S6_COMMENT',
  ACC:  'S7_ACCEPT',
  REJ:  'S8_REJECT',
};

function classifyToken(lexeme) {
  if (!lexeme) return { type: TT.UNKNOWN, state: DFA_STATES.REJ };
  const up = lexeme.toUpperCase();
  if (lexeme.startsWith(';'))
    return { type: TT.COMMENT, state: DFA_STATES.CMT };
  if (lexeme === ',')
    return { type: TT.COMMA, state: DFA_STATES.ACC };
  if (OPCODES[up])
    return { type: TT.OPCODE, state: DFA_STATES.ACC };
  if (/^R[0-7]$/.test(up))
    return { type: TT.REGISTER, state: DFA_STATES.ACC };
  if (/^\d+$/.test(lexeme) && parseInt(lexeme) <= 255)
    return { type: TT.NUMBER, state: DFA_STATES.ACC };
  if (/^[A-Za-z_][A-Za-z0-9_]*:$/.test(lexeme))
    return { type: TT.LABEL_DEF, state: DFA_STATES.ACC };
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(lexeme))
    return { type: TT.LABEL, state: DFA_STATES.ACC };
  return { type: TT.UNKNOWN, state: DFA_STATES.REJ };
}

function traceDFA(lexeme) {
  // Simulate DFA trace path
  const states = [DFA_STATES.S0];
  const chars = [...lexeme];
  if (chars[0] === ';') { states.push(DFA_STATES.CMT); return states; }
  if (chars[0] === ',') { states.push(DFA_STATES.ACC); return states; }
  if (/[A-Za-z_]/.test(chars[0])) {
    if (chars[0].toUpperCase() === 'R' && chars.length === 2 && /[0-7]/.test(chars[1])) {
      states.push(DFA_STATES.REG_R, DFA_STATES.REG_D, DFA_STATES.ACC);
    } else if (OPCODES[lexeme.toUpperCase()]) {
      states.push(DFA_STATES.OPCD, DFA_STATES.ACC);
    } else if (lexeme.endsWith(':')) {
      states.push(DFA_STATES.ALPH, DFA_STATES.ACC);
    } else {
      states.push(DFA_STATES.ALPH, DFA_STATES.ACC);
    }
  } else if (/\d/.test(chars[0])) {
    states.push(DFA_STATES.NUM, DFA_STATES.ACC);
    if (parseInt(lexeme) > 255) { states.pop(); states.push(DFA_STATES.REJ); }
  } else {
    states.push(DFA_STATES.REJ);
  }
  return states;
}

function tokenizeLine(line, lineNo) {
  const tokens = [];
  const raw = line.trimEnd();
  if (!raw || raw.trim() === '') return tokens;

  // Split respecting comments
  const commentIdx = raw.indexOf(';');
  let code = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw;
  const commentPart = commentIdx >= 0 ? raw.slice(commentIdx) : null;

  // Tokenize code part
  const parts = code.trim().split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    let p = parts[i];
    if (p === ',') { tokens.push({ lexeme: ',', ...classifyToken(','), line: lineNo }); continue; }
    // Check for "R1," patterns
    if (p.endsWith(',')) {
      const sub = p.slice(0, -1);
      const tok = classifyToken(sub);
      tokens.push({ lexeme: sub, ...tok, line: lineNo });
    } else {
      tokens.push({ lexeme: p, ...classifyToken(p), line: lineNo });
    }
  }
  if (commentPart) {
    tokens.push({ lexeme: commentPart, ...classifyToken(commentPart), line: lineNo });
  }
  return tokens;
}

function tokenizeProgram(source) {
  const lines = source.split('\n');
  const allTokens = [];
  const errors = [];
  lines.forEach((line, i) => {
    const toks = tokenizeLine(line, i + 1);
    toks.forEach(t => {
      if (t.type === TT.UNKNOWN) {
        errors.push(`Line ${i + 1}: Unknown token '${t.lexeme}'`);
      }
      allTokens.push(t);
    });
  });
  return { tokens: allTokens, errors };
}

/* ─────────────────────────────────────────────────────────────
   3.  ASSEMBLER
   ───────────────────────────────────────────────────────────── */
function assemble(source) {
  const lines = source.split('\n');
  const instructions = [];
  const symbolTable = {};
  const errors = [];

  // First pass – collect labels
  let addr = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].split(';')[0].trim();
    if (!line) continue;
    if (/^[A-Za-z_]\w*:$/.test(line)) {
      symbolTable[line.slice(0, -1).toUpperCase()] = addr;
    } else {
      addr++;
    }
  }

  // Second pass – assemble
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].split(';')[0].trim();
    if (!line) continue;
    if (/^[A-Za-z_]\w*:$/.test(line)) continue; // skip label-only lines

    const parts = line.split(/[\s,]+/).filter(Boolean);
    const mnem = parts[0].toUpperCase();
    const info = OPCODES[mnem];
    if (!info) { errors.push(`Line ${i + 1}: Unknown opcode '${parts[0]}'`); continue; }

    let word = 0;
    const opBits = info.code << 12;

    try {
      switch (info.fmt) {
        case 'NONE': // HALT
          word = opBits;
          break;
        case 'RD_IMM': {
          const rd = regNum(parts[1], i);
          const imm = parseImm(parts[2], i);
          word = opBits | (rd << 9) | (imm & 0xFF);
          break;
        }
        case 'RD_MEM':
        case 'RS_MEM': {
          const rd = regNum(parts[1], i);
          const addr2 = parseImm(parts[2], i);
          word = opBits | (rd << 9) | (addr2 & 0xFF);
          break;
        }
        case 'RD_RS': {
          const rd = regNum(parts[1], i);
          const rs = regNum(parts[2], i);
          word = opBits | (rd << 9) | (rs << 6);
          break;
        }
        case 'LABEL': {
          const label = parts[1] ? parts[1].toUpperCase() : null;
          const target = label !== null && symbolTable[label] !== undefined
            ? symbolTable[label]
            : parseImm(parts[1], i);
          word = opBits | (target & 0x1FF);
          break;
        }
        case 'RD_LABEL': {
          const rd = regNum(parts[1], i);
          const label = parts[2] ? parts[2].toUpperCase() : null;
          const target = label !== null && symbolTable[label] !== undefined
            ? symbolTable[label]
            : parseImm(parts[2], i);
          word = opBits | (rd << 9) | (target & 0x1FF);
          break;
        }
      }
    } catch (e) {
      errors.push(`Line ${i + 1}: ${e.message}`);
      continue;
    }

    const mnemStr = reconstructMnemonic(mnem, info.fmt, parts, symbolTable);
    instructions.push({ addr: instructions.length, word, mnem: mnemStr, sourceAddr: i + 1 });
  }

  return { instructions, symbolTable, errors };
}

function regNum(token, lineIdx) {
  if (!token) throw new Error(`Expected register, got nothing`);
  const m = token.toUpperCase().match(/^R([0-7])$/);
  if (!m) throw new Error(`Invalid register '${token}'`);
  return parseInt(m[1]);
}

function parseImm(token, lineIdx) {
  if (token === undefined || token === null) throw new Error(`Expected immediate value`);
  const n = parseInt(token);
  if (isNaN(n)) throw new Error(`Expected number, got '${token}'`);
  return n;
}

function reconstructMnemonic(mnem, fmt, parts, symbolTable) {
  switch (fmt) {
    case 'NONE': return mnem;
    case 'RD_IMM': return `${mnem} ${parts[1]}, ${parts[2]}`;
    case 'RD_MEM':
    case 'RS_MEM': return `${mnem} ${parts[1]}, [${parts[2]}]`;
    case 'RD_RS':  return `${mnem} ${parts[1]}, ${parts[2]}`;
    case 'LABEL':  return `${mnem} ${parts[1]}`;
    case 'RD_LABEL': return `${mnem} ${parts[1]}, ${parts[2]}`;
    default: return mnem;
  }
}

function wordToBinary(word) {
  return word.toString(2).padStart(16, '0');
}

/* ─────────────────────────────────────────────────────────────
   4.  HUFFMAN COMPRESSION
   ───────────────────────────────────────────────────────────── */
class HuffNode {
  constructor(sym, freq, left = null, right = null) {
    this.sym = sym; this.freq = freq; this.left = left; this.right = right;
  }
}

function buildHuffman(bytes) {
  if (bytes.length === 0) return { root: null, codes: {}, encoded: '', ratio: 0, origBits: 0, encBits: 0 };

  // Frequency table
  const freq = {};
  for (const b of bytes) freq[b] = (freq[b] || 0) + 1;

  // Min-heap (priority queue via sorted array, O(n log n))
  let heap = Object.entries(freq).map(([sym, f]) => new HuffNode(+sym, f));
  heap.sort((a, b) => a.freq - b.freq);

  // Build tree  O(n log n)
  while (heap.length > 1) {
    const left = heap.shift();
    const right = heap.shift();
    const merged = new HuffNode(null, left.freq + right.freq, left, right);
    // Insert in sorted position
    let i = 0;
    while (i < heap.length && heap[i].freq < merged.freq) i++;
    heap.splice(i, 0, merged);
  }

  const root = heap[0];

  // Generate codes
  const codes = {};
  function traverse(node, code) {
    if (!node) return;
    if (node.sym !== null) { codes[node.sym] = code || '0'; return; }
    traverse(node.left, code + '0');
    traverse(node.right, code + '1');
  }
  traverse(root, '');

  // Encode
  const encoded = bytes.map(b => codes[b]).join('');
  const origBits = bytes.length * 8;
  const encBits = encoded.length;
  const ratio = origBits > 0 ? ((1 - encBits / origBits) * 100).toFixed(1) : 0;

  return { root, codes, freq, encoded, ratio, origBits, encBits };
}

function huffmanDecode(encoded, root) {
  if (!root) return [];
  const result = [];
  let node = root;
  for (const bit of encoded) {
    node = bit === '0' ? node.left : node.right;
    if (node.sym !== null) { result.push(node.sym); node = root; }
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────
   5.  CPU SIMULATOR
   ───────────────────────────────────────────────────────────── */
class CPU {
  constructor(instructions) {
    this.instructions = instructions;       // array of 16-bit words
    this.pc = 0;
    this.registers = new Array(8).fill(0);  // R0–R7
    this.memory = new Array(256).fill(0);   // data memory (8-bit cells)
    this.zf = 0;                            // zero flag
    this.ir = 0;                            // instruction register
    this.halted = false;
    this.cycle = 0;
    this.log = [];
  }

  step() {
    if (this.halted) return { phase: 'HALT', detail: 'Already halted', changed: null };
    if (this.pc >= this.instructions.length) {
      this.halted = true;
      return { phase: 'HALT', detail: 'Program end', changed: null };
    }

    // FETCH
    const word = this.instructions[this.pc];
    this.ir = word;
    const fetchDetail = `IR ← MEM[${this.pc}] = ${wordToBinary(word)}`;

    // DECODE
    const opcode = (word >> 12) & 0xF;
    const rd     = (word >> 9)  & 0x7;
    const rs     = (word >> 6)  & 0x7;
    const imm    = (word)       & 0xFF;
    const addr   = (word)       & 0x1FF;
    const mnem   = Object.keys(OPCODES).find(k => OPCODES[k].code === opcode) || 'NOP';
    const decodeDetail = `OP=${mnem} RD=R${rd} RS=R${rs} IMM=${imm}`;

    // EXECUTE
    const prevRegs = [...this.registers];
    let executeDetail = '';
    let changed = null;

    this.pc++;

    switch (mnem) {
      case 'LOAD':
        this.registers[rd] = imm;
        executeDetail = `R${rd} ← ${imm}`;
        changed = rd;
        break;
      case 'LOADI':
        this.registers[rd] = this.memory[addr & 0xFF];
        executeDetail = `R${rd} ← MEM[${addr}] = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'STORE':
        this.memory[addr & 0xFF] = this.registers[rd] & 0xFF;
        executeDetail = `MEM[${addr}] ← R${rd}(${this.registers[rd]})`;
        break;
      case 'ADD':
        this.registers[rd] = (this.registers[rd] + this.registers[rs]) & 0xFF;
        this.zf = this.registers[rd] === 0 ? 1 : 0;
        executeDetail = `R${rd} ← R${rd}+R${rs} = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'SUB':
        this.registers[rd] = (this.registers[rd] - this.registers[rs]) & 0xFF;
        this.zf = this.registers[rd] === 0 ? 1 : 0;
        executeDetail = `R${rd} ← R${rd}-R${rs} = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'MUL':
        this.registers[rd] = (this.registers[rd] * this.registers[rs]) & 0xFF;
        this.zf = this.registers[rd] === 0 ? 1 : 0;
        executeDetail = `R${rd} ← R${rd}×R${rs} = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'AND':
        this.registers[rd] = (this.registers[rd] & this.registers[rs]) & 0xFF;
        executeDetail = `R${rd} ← R${rd}&R${rs} = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'OR':
        this.registers[rd] = (this.registers[rd] | this.registers[rs]) & 0xFF;
        executeDetail = `R${rd} ← R${rd}|R${rs} = ${this.registers[rd]}`;
        changed = rd;
        break;
      case 'JMP':
        this.pc = addr;
        executeDetail = `PC ← ${addr}`;
        break;
      case 'JZ':
        if (this.registers[rd] === 0 || this.zf) {
          this.pc = addr & 0x1FF;
          executeDetail = `ZF=${this.zf}, R${rd}=${this.registers[rd]} → PC ← ${addr & 0x1FF}`;
        } else {
          executeDetail = `ZF=${this.zf}, R${rd}=${this.registers[rd]} → no jump`;
        }
        break;
      case 'HALT':
        this.halted = true;
        executeDetail = `CPU halted after ${this.cycle + 1} cycles`;
        break;
      default:
        executeDetail = 'NOP';
    }

    this.cycle++;
    const entry = {
      step: this.cycle, pc: this.pc - (mnem !== 'JMP' && mnem !== 'JZ' ? 1 : 0),
      mnem, changed, halted: this.halted,
      info: executeDetail
    };
    this.log.push(entry);

    return {
      fetchDetail, decodeDetail, executeDetail,
      changed, halted: this.halted, mnem
    };
  }
}

/* ─────────────────────────────────────────────────────────────
   6.  UI CONTROLLER
   ───────────────────────────────────────────────────────────── */
let currentStep = 0;
let pipelineResults = null;
let cpuInstance = null;
let prevRegValues = new Array(8).fill(0);

const EXAMPLE_PROGRAM = `; === MiniCPU Demo: Sum 1..5 ===
; Compute 1+2+3+4+5 = 15 in R0
LOAD R0, 0       ; accumulator = 0
LOAD R1, 1       ; counter = 1
LOAD R2, 5       ; limit = 5
LOOP:
ADD  R0, R1      ; acc = acc + counter
ADD  R1, R1      ; wait, wrong – let's use R3
LOAD R3, 1
SUB  R2, R3      ; limit--
JZ   R2, DONE   ; if limit==0, jump to DONE
JMP  LOOP
DONE:
HALT`;

const EXAMPLE_SIMPLE = `; Basic arithmetic
LOAD R1, 10
LOAD R2, 3
ADD  R1, R2
STORE R1, 20
LOADI R3, 20
HALT`;

// ── DOM Refs ────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const codeEditor   = $('codeEditor');
const lineNumbers  = $('lineNumbers');
const errorLog     = $('errorLog');
const tabEls       = document.querySelectorAll('.pipeline-step');
const panels       = {
  0: $('panel-editor'),
  1: $('panel-tokenizer'),
  2: $('panel-assembler'),
  3: $('panel-huffman'),
  4: $('panel-cpu'),
};

// ── Line Numbers ────────────────────────────────────────────
function updateLineNumbers() {
  const lines = codeEditor.value.split('\n');
  lineNumbers.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
}
codeEditor.addEventListener('input', updateLineNumbers);
codeEditor.addEventListener('scroll', () => { lineNumbers.scrollTop = codeEditor.scrollTop; });

// ── Tab Navigation ──────────────────────────────────────────
function showTab(n) {
  currentStep = n;
  tabEls.forEach(el => el.classList.toggle('active', +el.dataset.step === n));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle('hidden', +k !== n));
}
tabEls.forEach(el => el.addEventListener('click', () => showTab(+el.dataset.step)));

// ── Load Example ────────────────────────────────────────────
$('btnLoadExample').addEventListener('click', () => {
  codeEditor.value = EXAMPLE_SIMPLE;
  updateLineNumbers();
});
$('btnClear').addEventListener('click', () => { codeEditor.value = ''; updateLineNumbers(); });

// ── MAIN RUN PIPELINE ────────────────────────────────────────
$('btnRun').addEventListener('click', () => {
  const source = codeEditor.value;
  if (!source.trim()) { showError('Editor is empty. Write or load a program first.'); return; }
  hideError();

  // 1) Tokenize
  const { tokens, errors: tokErrors } = tokenizeProgram(source);
  if (tokErrors.length) { showError(tokErrors.join('\n')); return; }

  // 2) Assemble
  const { instructions, symbolTable, errors: asmErrors } = assemble(source);
  if (asmErrors.length) { showError(asmErrors.join('\n')); return; }
  if (instructions.length === 0) { showError('No instructions assembled.'); return; }

  // 3) Huffman
  const words = instructions.map(i => i.word);
  const bytes = [];
  words.forEach(w => { bytes.push((w >> 8) & 0xFF); bytes.push(w & 0xFF); });
  const huff = buildHuffman(bytes);

  // Store results
  pipelineResults = { source, tokens, instructions, symbolTable, huff, bytes };

  // Render all panels
  renderTokenizer(tokens);
  renderAssembler(instructions, symbolTable);
  renderHuffman(huff, bytes, instructions);
  initCPU(instructions);

  // Switch to tokenizer panel
  showTab(1);
});

// ── Error display ────────────────────────────────────────────
function showError(msg) {
  errorLog.style.display = 'block';
  errorLog.innerHTML = '❌ ' + msg.replace(/\n/g, '<br>❌ ');
}
function hideError() { errorLog.style.display = 'none'; }

/* ═══════════════════════════════════════════════════════════
   RENDER: TOKENIZER
═══════════════════════════════════════════════════════════ */
function renderTokenizer(tokens) {
  const tbody = $('tokenTableBody');
  tbody.innerHTML = '';
  tokens.forEach(t => {
    if (t.type === TT.COMMA) return; // skip commas for cleanliness
    const trace = traceDFA(t.lexeme);
    const stateStr = trace.join(' → ');
    const isOk = t.state !== DFA_STATES.REJ && t.type !== TT.UNKNOWN;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.line}</td>
      <td class="tok-${t.type}">${escHtml(t.lexeme)}</td>
      <td><span class="tok-${t.type}">${t.type}</span></td>
      <td style="font-size:0.68rem;color:var(--text-dim)">${stateStr}</td>
      <td class="${isOk ? 'status-ok' : 'status-err'}">${isOk ? '✓ Accept' : '✗ Reject'}</td>`;
    tbody.appendChild(tr);
  });

  // Draw DFA diagram
  drawDFA();
}

function drawDFA() {
  const canvas = $('dfaCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Nodes
  const nodes = [
    { id:'S0',   x:60,  y:100, label:'S0\nSTART',  color:'#64ffda' },
    { id:'OPCD', x:190, y:50,  label:'S1\nOPCODE', color:'#b39ddb' },
    { id:'REG',  x:190, y:150, label:'S2\nREG_R',  color:'#80cbc4' },
    { id:'NUM',  x:330, y:150, label:'S4\nNUMBER', color:'#ffb74d' },
    { id:'ALPH', x:330, y:50,  label:'S5\nALPHA',  color:'#ef9a9a' },
    { id:'ACC',  x:490, y:100, label:'S7\nACCEPT', color:'#a5d6a7' },
    { id:'REJ',  x:620, y:100, label:'S8\nREJECT', color:'#ef5350' },
  ];

  const edges = [
    { from:'S0', to:'OPCD', label:'letter+OPC' },
    { from:'S0', to:'REG',  label:'R[0-7]' },
    { from:'S0', to:'NUM',  label:'digit' },
    { from:'S0', to:'ALPH', label:'letter' },
    { from:'OPCD',to:'ACC', label:'valid' },
    { from:'REG', to:'ACC', label:'R0-R7' },
    { from:'REG', to:'REJ', label:'R8+' },
    { from:'NUM', to:'ACC', label:'≤255' },
    { from:'NUM', to:'REJ', label:'>255' },
    { from:'ALPH',to:'ACC', label:'label' },
  ];

  const nodeMap = {};
  nodes.forEach(n => nodeMap[n.id] = n);

  ctx.font = '11px JetBrains Mono, monospace';

  // Draw edges
  edges.forEach(e => {
    const from = nodeMap[e.from], to = nodeMap[e.to];
    if (!from || !to) return;
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const nx = dx/dist, ny = dy/dist;
    const r = 32;
    const sx = from.x + nx*r, sy = from.y + ny*r;
    const ex = to.x - nx*r, ey = to.y - ny*r;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = 'rgba(100,255,218,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(ey-sy, ex-sx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex-8*Math.cos(angle-0.4), ey-8*Math.sin(angle-0.4));
    ctx.lineTo(ex-8*Math.cos(angle+0.4), ey-8*Math.sin(angle+0.4));
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,255,218,0.35)';
    ctx.fill();

    // Edge label
    const mx = (sx+ex)/2, my = (sy+ey)/2;
    ctx.fillStyle = 'rgba(143,163,199,0.85)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(e.label, mx+2, my-4);
  });

  // Draw nodes
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 32, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(13,20,36,0.9)';
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (n.id === 'ACC') {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 26, 0, Math.PI*2);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = n.color;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const lines2 = n.label.split('\n');
    lines2.forEach((l, i) => ctx.fillText(l, n.x, n.y + (i - (lines2.length-1)/2) * 12));
  });
  ctx.textAlign = 'left';
}

/* ═══════════════════════════════════════════════════════════
   RENDER: ASSEMBLER
═══════════════════════════════════════════════════════════ */
function renderAssembler(instructions, symbolTable) {
  // Symbol table
  const stBody = $('symbolTableBody');
  stBody.innerHTML = '';
  Object.entries(symbolTable).forEach(([lbl, addr]) => {
    stBody.innerHTML += `<tr><td style="color:var(--cyan)">${lbl}</td><td>0x${addr.toString(16).toUpperCase().padStart(2,'0')}</td></tr>`;
  });
  if (!Object.keys(symbolTable).length) {
    stBody.innerHTML = '<tr><td colspan="2" style="color:var(--text-dim);font-style:italic">No labels</td></tr>';
  }

  // Machine code
  const list = $('machineCodeList');
  list.innerHTML = '';
  instructions.forEach(ins => {
    const bin = wordToBinary(ins.word);
    const op  = bin.slice(0, 4);
    const rd  = bin.slice(4, 7);
    const rest= bin.slice(7);
    const row = document.createElement('div');
    row.className = 'mc-row';
    row.innerHTML = `
      <span class="mc-addr">0x${ins.addr.toString(16).padStart(2,'0').toUpperCase()}</span>
      <span class="mc-bits"><span class="bit-opcode">${op}</span> <span class="bit-reg">${rd}</span> <span class="bit-imm">${rest}</span></span>
      <span class="mc-mnem">${escHtml(ins.mnem)}</span>`;
    list.appendChild(row);
  });

  // Opcode map
  const body = $('opcodeMapBody');
  body.innerHTML = '';
  Object.entries(OPCODES).forEach(([mnem, info]) => {
    body.innerHTML += `<tr>
      <td style="color:var(--cyan)">${mnem}</td>
      <td><span style="color:var(--orange)">${info.code.toString(2).padStart(4,'0')}</span></td>
    </tr>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   RENDER: HUFFMAN
═══════════════════════════════════════════════════════════ */
function renderHuffman(huff, bytes, instructions) {
  // Stats
  $('huffmanStats').innerHTML = `
    <div class="stat-card stat-cyan">
      <div class="stat-value">${huff.origBits}</div>
      <div class="stat-label">Original bits</div>
    </div>
    <div class="stat-card stat-purple">
      <div class="stat-value">${huff.encBits}</div>
      <div class="stat-label">Encoded bits</div>
    </div>
    <div class="stat-card stat-green">
      <div class="stat-value">${huff.ratio}%</div>
      <div class="stat-label">Compression ratio</div>
    </div>
    <div class="stat-card stat-orange">
      <div class="stat-value">${Object.keys(huff.codes || {}).length}</div>
      <div class="stat-label">Unique symbols</div>
    </div>`;

  // Code table
  const body = $('huffmanCodeBody');
  body.innerHTML = '';
  if (huff.codes) {
    const entries = Object.entries(huff.codes).sort((a, b) => a[1].length - b[1].length);
    entries.forEach(([sym, code]) => {
      const origBitsPerSym = 8;
      const saved = origBitsPerSym - code.length;
      const freq = huff.freq[sym] || 0;
      body.innerHTML += `<tr>
        <td>0x${(+sym).toString(16).toUpperCase().padStart(2,'0')} (${+sym})</td>
        <td>${freq}</td>
        <td><span style="font-family:var(--font-mono);color:var(--cyan);letter-spacing:2px">${code}</span></td>
        <td style="color:${saved >= 0 ? 'var(--green)' : 'var(--red)'}">${saved >= 0 ? '+' : ''}${saved}</td>
      </tr>`;
    });
  }

  // Draw tree
  drawHuffmanTree(huff.root);

  // Bitstream preview
  const preview = huff.encoded ? huff.encoded.slice(0, 512) + (huff.encoded.length > 512 ? '…' : '') : '–';
  $('bitstreamBox').innerHTML = formatBitstream(preview);
}

function formatBitstream(bits) {
  return [...bits].map((b, i) => {
    if (b === '…') return '<span style="color:var(--text-dim)">…</span>';
    const color = b === '0' ? 'var(--cyan)' : 'var(--purple)';
    return `<span style="color:${color}">${b}</span>`;
  }).join('');
}

function drawHuffmanTree(root) {
  const canvas = $('huffmanTreeCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!root) return;

  function getDepth(node) {
    if (!node) return 0;
    return 1 + Math.max(getDepth(node.left), getDepth(node.right));
  }
  const depth = Math.min(getDepth(root), 6);

  function draw(node, x, y, hGap, level) {
    if (!node || level > 6) return;
    const nodeR = 18;

    if (node.left) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - hGap, y + 50);
      ctx.strokeStyle = 'rgba(100,255,218,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,255,218,0.6)';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText('0', x - hGap/2 - 8, y + 28);
      draw(node.left, x - hGap, y + 50, hGap * 0.5, level + 1);
    }
    if (node.right) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + hGap, y + 50);
      ctx.strokeStyle = 'rgba(187,134,252,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(187,134,252,0.6)';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText('1', x + hGap/2 + 2, y + 28);
      draw(node.right, x + hGap, y + 50, hGap * 0.5, level + 1);
    }

    // Draw node
    const isLeaf = node.sym !== null;
    ctx.beginPath();
    ctx.arc(x, y, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = isLeaf ? 'rgba(100,255,218,0.12)' : 'rgba(17,24,39,0.9)';
    ctx.fill();
    ctx.strokeStyle = isLeaf ? '#64ffda' : 'rgba(100,255,218,0.3)';
    ctx.lineWidth = isLeaf ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = isLeaf ? '#64ffda' : 'rgba(143,163,199,0.8)';
    ctx.font = `${isLeaf ? 'bold ' : ''}9px JetBrains Mono`;
    ctx.textAlign = 'center';
    if (isLeaf) {
      ctx.fillText(`${node.sym}`, x, y - 3);
      ctx.fillStyle = 'rgba(100,255,218,0.5)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(`f:${node.freq}`, x, y + 8);
    } else {
      ctx.fillText(`${node.freq}`, x, y + 4);
    }
    ctx.textAlign = 'left';
  }

  draw(root, canvas.width / 2, 22, canvas.width / 4, 0);
}

/* ═══════════════════════════════════════════════════════════
   RENDER: CPU SIMULATOR
═══════════════════════════════════════════════════════════ */
function initCPU(instructions) {
  const words = instructions.map(i => i.word);
  cpuInstance = new CPU(words);
  prevRegValues = new Array(8).fill(0);

  // Build registers grid
  const grid = $('registersGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const div = document.createElement('div');
    div.className = 'register-item';
    div.id = `reg-R${i}`;
    div.innerHTML = `<span class="reg-name">R${i}</span><span class="reg-val" id="regval-R${i}">0</span>`;
    grid.appendChild(div);
  }

  renderMemoryView(instructions, -1);
  renderDataMemory();
  $('regPC').textContent = '0x00';
  $('regIR').textContent = '0000 0000 0000 0000';
  $('regZF').textContent = '0';
  $('execLog').innerHTML = '';
  $('cpuStatusBox').innerHTML = '<span class="status-idle">⏸ Ready — click Step or Run All</span>';
  setCyclePhase(null, '', '', '');
}

function renderMemoryView(instructions, currentPc) {
  const view = $('memoryView');
  view.innerHTML = '';
  instructions.forEach((ins, i) => {
    const div = document.createElement('div');
    div.className = 'mem-row' + (i === currentPc ? ' current' : '');
    const bin = wordToBinary(ins.word);
    div.innerHTML = `
      <span class="mem-addr">0x${i.toString(16).padStart(2,'0').toUpperCase()}</span>
      <span class="mem-bits">${bin.slice(0,8)} ${bin.slice(8)}</span>
      <span class="mem-mnem">${escHtml(ins.mnem || '?')}</span>`;
    view.appendChild(div);
  });
}

function renderDataMemory() {
  const view = $('dataMemoryView');
  view.innerHTML = '';
  // Show only non-zero cells + some context
  const nonZero = cpuInstance.memory.map((v, i) => ({ addr: i, val: v })).filter(x => x.val !== 0);
  if (nonZero.length === 0) {
    view.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;font-family:var(--font-mono);padding:0.5rem">All zeros</div>';
    return;
  }
  nonZero.slice(0, 32).forEach(({ addr, val }) => {
    const div = document.createElement('div');
    div.className = 'data-mem-row written';
    div.innerHTML = `<span style="color:var(--text-dim)">0x${addr.toString(16).padStart(2,'0').toUpperCase()}</span><span>${val} (0x${val.toString(16).padStart(2,'0').toUpperCase()})</span>`;
    view.appendChild(div);
  });
}

function updateRegisters(changed) {
  for (let i = 0; i < 8; i++) {
    const el = $(`regval-R${i}`);
    const container = $(`reg-R${i}`);
    if (el) {
      el.textContent = cpuInstance.registers[i];
      if (i === changed && cpuInstance.registers[i] !== prevRegValues[i]) {
        container.classList.add('changed');
        setTimeout(() => container.classList.remove('changed'), 700);
      }
    }
  }
  prevRegValues = [...cpuInstance.registers];
  $('regPC').textContent = '0x' + cpuInstance.pc.toString(16).padStart(2, '0').toUpperCase();
  $('regIR').textContent = wordToBinary(cpuInstance.ir).replace(/(.{4})/g, '$1 ').trim();
  $('regZF').textContent = cpuInstance.zf;
}

function setCyclePhase(active, fetch, decode, execute) {
  ['cycleFetch', 'cycleDecode', 'cycleExecute'].forEach(id => $('p'+id.slice(1)) && void 0);
  document.querySelectorAll('.cycle-phase').forEach(el => el.classList.remove('active'));
  if (active === 'fetch') $('cycleFetch').classList.add('active');
  else if (active === 'decode') $('cycleDecode').classList.add('active');
  else if (active === 'execute') $('cycleExecute').classList.add('active');

  $('fetchDetail').textContent   = fetch   || '–';
  $('decodeDetail').textContent  = decode  || '–';
  $('executeDetail').textContent = execute || '–';
}

function addLogEntry(step) {
  const log = $('execLog');
  const div = document.createElement('div');
  div.className = 'log-entry' + (step.halted ? ' halted' : '');
  div.innerHTML = `
    <span class="log-step">#${step.step}</span>
    <span class="log-pc">PC:${step.pc}</span>
    <span class="log-instr">${step.mnem}</span>
    <span class="log-info">${escHtml(step.info)}</span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

$('btnStep').addEventListener('click', () => {
  if (!cpuInstance) return;
  if (cpuInstance.halted) { $('cpuStatusBox').innerHTML = '<span class="status-halted">✓ Halted</span>'; return; }

  const result = cpuInstance.step();
  const instr = pipelineResults ? pipelineResults.instructions[cpuInstance.pc - 1] : null;

  // Animate phases
  setCyclePhase('fetch', result.fetchDetail, result.decodeDetail, result.executeDetail);

  updateRegisters(result.changed);
  renderMemoryView(pipelineResults.instructions, cpuInstance.halted ? -1 : cpuInstance.pc);
  renderDataMemory();

  const lastLog = cpuInstance.log[cpuInstance.log.length - 1];
  if (lastLog) addLogEntry(lastLog);

  if (result.halted) {
    $('cpuStatusBox').innerHTML = `<span class="status-halted">✓ HALT after ${cpuInstance.cycle} cycles</span>`;
  } else {
    $('cpuStatusBox').innerHTML = `<span class="status-running">▶ Running — cycle ${cpuInstance.cycle}</span>`;
  }
});

$('btnReset').addEventListener('click', () => {
  if (!pipelineResults) return;
  initCPU(pipelineResults.instructions);
});

$('btnRunAll').addEventListener('click', () => {
  if (!cpuInstance) return;
  let guard = 0;
  const MAX = 10000;
  while (!cpuInstance.halted && guard++ < MAX) cpuInstance.step();
  // Re-render everything
  for (const entry of cpuInstance.log) addLogEntry(entry);
  updateRegisters(null);
  renderMemoryView(pipelineResults.instructions, -1);
  renderDataMemory();
  const lastResult = cpuInstance.log[cpuInstance.log.length - 1];
  if (lastResult) {
    setCyclePhase('execute', '(batch run)', '(batch run)', lastResult.info);
  }
  $('cpuStatusBox').innerHTML = cpuInstance.halted
    ? `<span class="status-halted">✓ HALT after ${cpuInstance.cycle} cycles</span>`
    : `<span class="status-error">⚠ Stopped (max ${MAX} cycles)</span>`;
});

/* ── Help Panel ────────────────────────────────────────────── */
const helpBody = $('helpBody');
helpBody.innerHTML = INSTRUCTION_HELP.map(h => `
  <div class="help-entry">
    <span class="help-mnem">${h.mnem.split(' ')[0]}</span>
    <span class="help-syntax">${h.syntax}</span>
    <span class="help-entry-desc">${h.desc}</span>
  </div>`).join('');

$('helpFab').addEventListener('click', () => $('helpPanel').classList.toggle('hidden'));
$('helpClose').addEventListener('click', () => $('helpPanel').classList.add('hidden'));

/* ── Utility ─────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Init ─────────────────────────────────────────────────── */
codeEditor.value = EXAMPLE_SIMPLE;
updateLineNumbers();
