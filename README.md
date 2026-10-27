# 🖥️ MiniCPU Studio – Assembly Simulator

> A tiny assembly language simulator featuring DFA-based tokenizing, machine code assembly, Huffman compression, and step-by-step CPU simulation — all in the browser, no installation needed.

🚀 **Live Demo:** [https://micro-six-lemon.vercel.app](https://micro-six-lemon.vercel.app)

---

## ✨ Features

### 🔍 DFA Tokenizer — *Formal Languages & Automata Theory*
- Tokenizes assembly source code using a Deterministic Finite Automaton (DFA)
- Displays the DFA state diagram visually on a canvas
- Shows a full token stream table: Lexeme, Token Type, DFA State, and Accept/Reject status

### ⚙️ Assembler — *Computer Organization & Architecture*
- Translates assembly mnemonics into 16-bit binary machine code
- Fixed-length instruction format: `OPCODE (4 bits) | DEST (3 bits) | SRC/IMM (9 bits)`
- Generates a Symbol Table (labels → addresses) and an Opcode Map

### 🌳 Huffman Compression — *Design & Analysis of Algorithms*
- Applies Huffman coding to the assembled machine code bitstream
- Visualizes the Huffman tree on a canvas
- Shows per-symbol frequency, code, and bits saved
- Displays compression ratio and total space savings
- Complexity analysis: **O(n log n)**

### 💻 CPU Simulator — *Fetch → Decode → Execute Cycle*
- Step-by-step execution of the assembled program
- Live register file (R0–R7), Program Counter (PC), Instruction Register (IR), Zero Flag (ZF)
- Visual Fetch / Decode / Execute phase indicator
- Program memory view with PC pointer
- Data memory (RAM) view
- Execution log per cycle

---

## 🧩 Supported Instructions

| Mnemonic | Description           | Example            |
|----------|-----------------------|--------------------|
| `LOAD`   | Load immediate/reg    | `LOAD R1, 10`      |
| `STORE`  | Store to memory       | `STORE R1, 5`      |
| `ADD`    | Add registers         | `ADD R1, R2`       |
| `SUB`    | Subtract registers    | `SUB R1, R2`       |
| `MUL`    | Multiply registers    | `MUL R1, R2`       |
| `AND`    | Bitwise AND           | `AND R1, R2`       |
| `OR`     | Bitwise OR            | `OR R1, R2`        |
| `JMP`    | Unconditional jump    | `JMP loop`         |
| `JZ`     | Jump if zero          | `JZ done`          |
| `HALT`   | Stop execution        | `HALT`             |

- **Registers:** R0 – R7
- **Immediates:** 0 – 255
- **Labels:** alphabetic identifiers (e.g., `loop:`, `done:`)
- **Comments:** lines starting with `;`

---

## 🗂️ Project Structure

```
micro/
├── index.html   # App shell & all panel markup
├── style.css    # Full dark-mode design system & animations
└── app.js       # DFA tokenizer, assembler, Huffman, CPU simulator logic
```

No frameworks, no dependencies — pure **HTML + CSS + JavaScript**.

---

## 🚀 Deployment

Deployed on **Vercel** (static hosting, zero config):

| | |
|---|---|
| **Production URL** | https://micro-six-lemon.vercel.app |
| **Platform** | [Vercel](https://vercel.com) |

### Redeploy after changes
```bash
vercel --prod
```

---

## 💻 Run Locally

No build step needed — just open the file:

```bash
# Option 1: Open directly
start index.html

# Option 2: Serve with any static server
npx serve .
```

---

## 📚 Academic Concepts Covered

| Subject | Concept Applied |
|---------|----------------|
| **FLAT** (Formal Languages & Automata Theory) | DFA-based lexical analysis / tokenization |
| **COA** (Computer Organization & Architecture) | 16-bit ISA design, Fetch-Decode-Execute cycle |
| **DAA** (Design & Analysis of Algorithms) | Huffman coding, min-heap, O(n log n) complexity |

---

## 📄 License

MIT — free to use, modify, and distribute.
