// spc700-js — Copyright (c) 2026 Mitsutaka Okazaki. ISC license; see LICENSE.md.
// upstream/src/spc700.ts
var CYCLES = new Uint8Array([
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  5,
  4,
  5,
  4,
  6,
  8,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  6,
  5,
  2,
  2,
  4,
  6,
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  5,
  4,
  5,
  4,
  5,
  4,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  6,
  5,
  2,
  2,
  3,
  8,
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  4,
  4,
  5,
  4,
  6,
  6,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  4,
  5,
  2,
  2,
  4,
  3,
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  4,
  4,
  5,
  4,
  5,
  5,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  5,
  5,
  2,
  2,
  3,
  6,
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  5,
  4,
  5,
  2,
  4,
  5,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  5,
  5,
  2,
  2,
  12,
  5,
  3,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  6,
  4,
  4,
  5,
  2,
  4,
  4,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  5,
  5,
  5,
  5,
  2,
  2,
  3,
  4,
  3,
  8,
  4,
  5,
  4,
  5,
  4,
  7,
  2,
  5,
  6,
  4,
  5,
  2,
  4,
  9,
  2,
  8,
  4,
  5,
  5,
  6,
  6,
  7,
  4,
  5,
  5,
  5,
  2,
  2,
  6,
  3,
  2,
  8,
  4,
  5,
  3,
  4,
  3,
  6,
  2,
  4,
  5,
  3,
  4,
  3,
  4,
  3,
  2,
  8,
  4,
  5,
  4,
  5,
  5,
  6,
  3,
  4,
  5,
  4,
  2,
  2,
  4,
  3
]);
var BRANCH_PENALTY = 2;
var SPC700 = class {
  constructor(bus) {
    this.bus = bus;
    this.A = 0;
    this.X = 0;
    this.Y = 0;
    this.SP = 0;
    this.PC = 0;
    this.fN = 0;
    this.fV = 0;
    this.fP = 0;
    this.fB = 0;
    this.fH = 0;
    this.fI = 0;
    this.fZ = 0;
    this.fC = 0;
    this.halted = false;
    this.lastCycles = 0;
    this.opcode = 0;
  }
  get PSW() {
    return this.fN << 7 | this.fV << 6 | this.fP << 5 | this.fB << 4 | this.fH << 3 | this.fI << 2 | this.fZ << 1 | this.fC;
  }
  set PSW(v) {
    this.fN = v >> 7 & 1;
    this.fV = v >> 6 & 1;
    this.fP = v >> 5 & 1;
    this.fB = v >> 4 & 1;
    this.fH = v >> 3 & 1;
    this.fI = v >> 2 & 1;
    this.fZ = v >> 1 & 1;
    this.fC = v & 1;
  }
  get YA() {
    return this.Y << 8 | this.A;
  }
  set YA(v) {
    this.A = v & 255;
    this.Y = v >> 8 & 255;
  }
  reset() {
    this.A = this.X = this.Y = 0;
    this.SP = 239;
    this.PSW = 0;
    this.halted = false;
    this.PC = this.read16(65534);
  }
  read(addr) {
    return this.bus.read(addr & 65535);
  }
  write(addr, value) {
    this.bus.write(addr & 65535, value & 255);
  }
  read16(addr) {
    return this.read(addr) | this.read(addr + 1) << 8;
  }
  readDP(offset) {
    return this.read(this.fP << 8 | offset & 255);
  }
  writeDP(offset, value) {
    this.write(this.fP << 8 | offset & 255, value);
  }
  readDP16(offset) {
    return this.readDP(offset) | this.readDP(offset + 1) << 8;
  }
  writeDP16(offset, value) {
    this.writeDP(offset, value & 255);
    this.writeDP(offset + 1, value >> 8 & 255);
  }
  fetch() {
    const v = this.read(this.PC);
    this.PC = this.PC + 1 & 65535;
    return v;
  }
  fetch16() {
    return this.fetch() | this.fetch() << 8;
  }
  push(value) {
    this.write(256 | this.SP, value);
    this.SP = this.SP - 1 & 255;
  }
  pop() {
    this.SP = this.SP + 1 & 255;
    return this.read(256 | this.SP);
  }
  push16(value) {
    this.push(value >> 8 & 255);
    this.push(value & 255);
  }
  pop16() {
    return this.pop() | this.pop() << 8;
  }
  setNZ(v) {
    this.fN = v >> 7 & 1;
    this.fZ = (v & 255) === 0 ? 1 : 0;
    return v & 255;
  }
  setNZ16(v) {
    this.fN = v >> 15 & 1;
    this.fZ = (v & 65535) === 0 ? 1 : 0;
    return v & 65535;
  }
  adc(a, b) {
    const r = a + b + this.fC;
    this.fC = r > 255 ? 1 : 0;
    this.fH = ((a ^ b ^ r) & 16) !== 0 ? 1 : 0;
    this.fV = ((a ^ r) & (b ^ r) & 128) !== 0 ? 1 : 0;
    return this.setNZ(r);
  }
  sbc(a, b) {
    return this.adc(a, b ^ 255);
  }
  cmp(a, b) {
    const r = a - b;
    this.fC = r >= 0 ? 1 : 0;
    this.setNZ(r & 255);
    return a;
  }
  asl(v) {
    this.fC = v >> 7 & 1;
    return this.setNZ(v << 1);
  }
  lsr(v) {
    this.fC = v & 1;
    return this.setNZ(v >> 1);
  }
  rol(v) {
    const c = this.fC;
    this.fC = v >> 7 & 1;
    return this.setNZ(v << 1 | c);
  }
  ror(v) {
    const c = this.fC;
    this.fC = v & 1;
    return this.setNZ(v >> 1 | c << 7);
  }
  addw(a, b) {
    const r = a + b + this.fC;
    this.fC = r > 65535 ? 1 : 0;
    this.fH = ((a ^ b ^ r) & 4096) !== 0 ? 1 : 0;
    this.fV = ((a ^ r) & (b ^ r) & 32768) !== 0 ? 1 : 0;
    return this.setNZ16(r);
  }
  bitOperand() {
    const v = this.fetch16();
    return { addr: v & 8191, bit: v >> 13 & 7 };
  }
  branch(taken) {
    const offset = this.fetch() << 24 >> 24;
    if (taken) {
      this.PC = this.PC + offset & 65535;
      this.lastCycles += BRANCH_PENALTY;
    }
  }
  branchBit(set) {
    const d = this.fetch();
    const v = this.readDP(d);
    const bit = this.opcode >> 5 & 7;
    this.branch((v >> bit & 1) === (set ? 1 : 0));
  }
  step() {
    if (this.halted) {
      this.lastCycles = 2;
      return 2;
    }
    const op = this.fetch();
    this.opcode = op;
    this.lastCycles = CYCLES[op];
    switch (op) {
      case 4:
        this.A = this.setNZ(this.A | this.readDP(this.fetch()));
        break;
      case 5:
        this.A = this.setNZ(this.A | this.read(this.fetch16()));
        break;
      case 6:
        this.A = this.setNZ(this.A | this.readDP(this.X));
        break;
      case 7:
        this.A = this.setNZ(this.A | this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 8:
        this.A = this.setNZ(this.A | this.fetch());
        break;
      case 9:
        this.dpDP((a, b) => this.setNZ(b | a));
        break;
      case 20:
        this.A = this.setNZ(this.A | this.readDP(this.fetch() + this.X));
        break;
      case 21:
        this.A = this.setNZ(this.A | this.read(this.fetch16() + this.X));
        break;
      case 22:
        this.A = this.setNZ(this.A | this.read(this.fetch16() + this.Y));
        break;
      case 23:
        this.A = this.setNZ(this.A | this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 24:
        this.dpImm((a, b) => this.setNZ(b | a));
        break;
      case 25:
        this.xy((a, b) => this.setNZ(a | b));
        break;
      case 36:
        this.A = this.setNZ(this.A & this.readDP(this.fetch()));
        break;
      case 37:
        this.A = this.setNZ(this.A & this.read(this.fetch16()));
        break;
      case 38:
        this.A = this.setNZ(this.A & this.readDP(this.X));
        break;
      case 39:
        this.A = this.setNZ(this.A & this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 40:
        this.A = this.setNZ(this.A & this.fetch());
        break;
      case 41:
        this.dpDP((a, b) => this.setNZ(b & a));
        break;
      case 52:
        this.A = this.setNZ(this.A & this.readDP(this.fetch() + this.X));
        break;
      case 53:
        this.A = this.setNZ(this.A & this.read(this.fetch16() + this.X));
        break;
      case 54:
        this.A = this.setNZ(this.A & this.read(this.fetch16() + this.Y));
        break;
      case 55:
        this.A = this.setNZ(this.A & this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 56:
        this.dpImm((a, b) => this.setNZ(b & a));
        break;
      case 57:
        this.xy((a, b) => this.setNZ(a & b));
        break;
      case 68:
        this.A = this.setNZ(this.A ^ this.readDP(this.fetch()));
        break;
      case 69:
        this.A = this.setNZ(this.A ^ this.read(this.fetch16()));
        break;
      case 70:
        this.A = this.setNZ(this.A ^ this.readDP(this.X));
        break;
      case 71:
        this.A = this.setNZ(this.A ^ this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 72:
        this.A = this.setNZ(this.A ^ this.fetch());
        break;
      case 73:
        this.dpDP((a, b) => this.setNZ(b ^ a));
        break;
      case 84:
        this.A = this.setNZ(this.A ^ this.readDP(this.fetch() + this.X));
        break;
      case 85:
        this.A = this.setNZ(this.A ^ this.read(this.fetch16() + this.X));
        break;
      case 86:
        this.A = this.setNZ(this.A ^ this.read(this.fetch16() + this.Y));
        break;
      case 87:
        this.A = this.setNZ(this.A ^ this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 88:
        this.dpImm((a, b) => this.setNZ(b ^ a));
        break;
      case 89:
        this.xy((a, b) => this.setNZ(a ^ b));
        break;
      case 100:
        this.cmp(this.A, this.readDP(this.fetch()));
        break;
      case 101:
        this.cmp(this.A, this.read(this.fetch16()));
        break;
      case 102:
        this.cmp(this.A, this.readDP(this.X));
        break;
      case 103:
        this.cmp(this.A, this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 104:
        this.cmp(this.A, this.fetch());
        break;
      case 105:
        this.dpDPCmp();
        break;
      case 116:
        this.cmp(this.A, this.readDP(this.fetch() + this.X));
        break;
      case 117:
        this.cmp(this.A, this.read(this.fetch16() + this.X));
        break;
      case 118:
        this.cmp(this.A, this.read(this.fetch16() + this.Y));
        break;
      case 119:
        this.cmp(this.A, this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 120:
        this.dpImmCmp();
        break;
      case 121:
        this.cmp(this.readDP(this.X), this.readDP(this.Y));
        break;
      case 132:
        this.A = this.adc(this.A, this.readDP(this.fetch()));
        break;
      case 133:
        this.A = this.adc(this.A, this.read(this.fetch16()));
        break;
      case 134:
        this.A = this.adc(this.A, this.readDP(this.X));
        break;
      case 135:
        this.A = this.adc(this.A, this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 136:
        this.A = this.adc(this.A, this.fetch());
        break;
      case 137:
        this.dpDP((a, b) => this.adc(b, a));
        break;
      case 148:
        this.A = this.adc(this.A, this.readDP(this.fetch() + this.X));
        break;
      case 149:
        this.A = this.adc(this.A, this.read(this.fetch16() + this.X));
        break;
      case 150:
        this.A = this.adc(this.A, this.read(this.fetch16() + this.Y));
        break;
      case 151:
        this.A = this.adc(this.A, this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 152:
        this.dpImm((a, b) => this.adc(b, a));
        break;
      case 153:
        this.xy((a, b) => this.adc(a, b));
        break;
      case 164:
        this.A = this.sbc(this.A, this.readDP(this.fetch()));
        break;
      case 165:
        this.A = this.sbc(this.A, this.read(this.fetch16()));
        break;
      case 166:
        this.A = this.sbc(this.A, this.readDP(this.X));
        break;
      case 167:
        this.A = this.sbc(this.A, this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 168:
        this.A = this.sbc(this.A, this.fetch());
        break;
      case 169:
        this.dpDP((a, b) => this.sbc(b, a));
        break;
      case 180:
        this.A = this.sbc(this.A, this.readDP(this.fetch() + this.X));
        break;
      case 181:
        this.A = this.sbc(this.A, this.read(this.fetch16() + this.X));
        break;
      case 182:
        this.A = this.sbc(this.A, this.read(this.fetch16() + this.Y));
        break;
      case 183:
        this.A = this.sbc(this.A, this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 184:
        this.dpImm((a, b) => this.sbc(b, a));
        break;
      case 185:
        this.xy((a, b) => this.sbc(a, b));
        break;
      case 30:
        this.cmp(this.X, this.read(this.fetch16()));
        break;
      case 62:
        this.cmp(this.X, this.readDP(this.fetch()));
        break;
      case 200:
        this.cmp(this.X, this.fetch());
        break;
      case 94:
        this.cmp(this.Y, this.read(this.fetch16()));
        break;
      case 126:
        this.cmp(this.Y, this.readDP(this.fetch()));
        break;
      case 173:
        this.cmp(this.Y, this.fetch());
        break;
      case 11:
        this.rmwDP((v) => this.asl(v), this.fetch());
        break;
      case 12:
        this.rmw((v) => this.asl(v), this.fetch16());
        break;
      case 27:
        this.rmwDP((v) => this.asl(v), this.fetch() + this.X);
        break;
      case 28:
        this.A = this.asl(this.A);
        break;
      case 43:
        this.rmwDP((v) => this.rol(v), this.fetch());
        break;
      case 44:
        this.rmw((v) => this.rol(v), this.fetch16());
        break;
      case 59:
        this.rmwDP((v) => this.rol(v), this.fetch() + this.X);
        break;
      case 60:
        this.A = this.rol(this.A);
        break;
      case 75:
        this.rmwDP((v) => this.lsr(v), this.fetch());
        break;
      case 76:
        this.rmw((v) => this.lsr(v), this.fetch16());
        break;
      case 91:
        this.rmwDP((v) => this.lsr(v), this.fetch() + this.X);
        break;
      case 92:
        this.A = this.lsr(this.A);
        break;
      case 107:
        this.rmwDP((v) => this.ror(v), this.fetch());
        break;
      case 108:
        this.rmw((v) => this.ror(v), this.fetch16());
        break;
      case 123:
        this.rmwDP((v) => this.ror(v), this.fetch() + this.X);
        break;
      case 124:
        this.A = this.ror(this.A);
        break;
      case 139:
        this.rmwDP((v) => this.setNZ(v - 1), this.fetch());
        break;
      case 140:
        this.rmw((v) => this.setNZ(v - 1), this.fetch16());
        break;
      case 155:
        this.rmwDP((v) => this.setNZ(v - 1), this.fetch() + this.X);
        break;
      case 156:
        this.A = this.setNZ(this.A - 1);
        break;
      case 171:
        this.rmwDP((v) => this.setNZ(v + 1), this.fetch());
        break;
      case 172:
        this.rmw((v) => this.setNZ(v + 1), this.fetch16());
        break;
      case 187:
        this.rmwDP((v) => this.setNZ(v + 1), this.fetch() + this.X);
        break;
      case 188:
        this.A = this.setNZ(this.A + 1);
        break;
      case 29:
        this.X = this.setNZ(this.X - 1);
        break;
      case 61:
        this.X = this.setNZ(this.X + 1);
        break;
      case 220:
        this.Y = this.setNZ(this.Y - 1);
        break;
      case 252:
        this.Y = this.setNZ(this.Y + 1);
        break;
      case 26: {
        const d = this.fetch();
        this.writeDP16(d, this.setNZ16(this.readDP16(d) - 1));
        break;
      }
      case 58: {
        const d = this.fetch();
        this.writeDP16(d, this.setNZ16(this.readDP16(d) + 1));
        break;
      }
      case 90: {
        const b = this.readDP16(this.fetch());
        const r = this.YA - b;
        this.fC = r >= 0 ? 1 : 0;
        this.setNZ16(r & 65535);
        break;
      }
      case 122: {
        const b = this.readDP16(this.fetch());
        this.fC = 0;
        this.YA = this.addw(this.YA, b);
        break;
      }
      case 154: {
        const b = this.readDP16(this.fetch());
        this.fC = 1;
        this.YA = this.addw(this.YA, b ^ 65535);
        break;
      }
      case 186:
        this.YA = this.setNZ16(this.readDP16(this.fetch()));
        break;
      case 218: {
        const d = this.fetch();
        this.readDP(d);
        this.writeDP16(d, this.YA);
        break;
      }
      case 232:
        this.A = this.setNZ(this.fetch());
        break;
      case 205:
        this.X = this.setNZ(this.fetch());
        break;
      case 141:
        this.Y = this.setNZ(this.fetch());
        break;
      case 228:
        this.A = this.setNZ(this.readDP(this.fetch()));
        break;
      case 229:
        this.A = this.setNZ(this.read(this.fetch16()));
        break;
      case 230:
        this.A = this.setNZ(this.readDP(this.X));
        break;
      case 231:
        this.A = this.setNZ(this.read(this.readDP16(this.fetch() + this.X)));
        break;
      case 244:
        this.A = this.setNZ(this.readDP(this.fetch() + this.X));
        break;
      case 245:
        this.A = this.setNZ(this.read(this.fetch16() + this.X));
        break;
      case 246:
        this.A = this.setNZ(this.read(this.fetch16() + this.Y));
        break;
      case 247:
        this.A = this.setNZ(this.read(this.readDP16(this.fetch()) + this.Y));
        break;
      case 191:
        this.A = this.setNZ(this.readDP(this.X));
        this.X = this.X + 1 & 255;
        break;
      case 248:
        this.X = this.setNZ(this.readDP(this.fetch()));
        break;
      case 249:
        this.X = this.setNZ(this.readDP(this.fetch() + this.Y));
        break;
      case 233:
        this.X = this.setNZ(this.read(this.fetch16()));
        break;
      case 235:
        this.Y = this.setNZ(this.readDP(this.fetch()));
        break;
      case 251:
        this.Y = this.setNZ(this.readDP(this.fetch() + this.X));
        break;
      case 236:
        this.Y = this.setNZ(this.read(this.fetch16()));
        break;
      case 196:
        this.writeDP(this.fetch(), this.A);
        break;
      case 197:
        this.write(this.fetch16(), this.A);
        break;
      case 198:
        this.writeDP(this.X, this.A);
        break;
      case 199:
        this.write(this.readDP16(this.fetch() + this.X), this.A);
        break;
      case 212:
        this.writeDP(this.fetch() + this.X, this.A);
        break;
      case 213:
        this.write(this.fetch16() + this.X, this.A);
        break;
      case 214:
        this.write(this.fetch16() + this.Y, this.A);
        break;
      case 215:
        this.write(this.readDP16(this.fetch()) + this.Y, this.A);
        break;
      case 175:
        this.writeDP(this.X, this.A);
        this.X = this.X + 1 & 255;
        break;
      case 216:
        this.writeDP(this.fetch(), this.X);
        break;
      case 217:
        this.writeDP(this.fetch() + this.Y, this.X);
        break;
      case 201:
        this.write(this.fetch16(), this.X);
        break;
      case 203:
        this.writeDP(this.fetch(), this.Y);
        break;
      case 219:
        this.writeDP(this.fetch() + this.X, this.Y);
        break;
      case 204:
        this.write(this.fetch16(), this.Y);
        break;
      case 143: {
        const v = this.fetch();
        this.writeDP(this.fetch(), v);
        break;
      }
      case 250: {
        const src = this.fetch();
        const v = this.readDP(src);
        this.writeDP(this.fetch(), v);
        break;
      }
      case 125:
        this.A = this.setNZ(this.X);
        break;
      case 221:
        this.A = this.setNZ(this.Y);
        break;
      case 93:
        this.X = this.setNZ(this.A);
        break;
      case 253:
        this.Y = this.setNZ(this.A);
        break;
      case 157:
        this.X = this.setNZ(this.SP);
        break;
      case 189:
        this.SP = this.X;
        break;
      case 45:
        this.push(this.A);
        break;
      case 77:
        this.push(this.X);
        break;
      case 109:
        this.push(this.Y);
        break;
      case 13:
        this.push(this.PSW);
        break;
      case 174:
        this.A = this.pop();
        break;
      case 206:
        this.X = this.pop();
        break;
      case 238:
        this.Y = this.pop();
        break;
      case 142:
        this.PSW = this.pop();
        break;
      case 16:
        this.branch(this.fN === 0);
        break;
      case 48:
        this.branch(this.fN === 1);
        break;
      case 80:
        this.branch(this.fV === 0);
        break;
      case 112:
        this.branch(this.fV === 1);
        break;
      case 144:
        this.branch(this.fC === 0);
        break;
      case 176:
        this.branch(this.fC === 1);
        break;
      case 208:
        this.branch(this.fZ === 0);
        break;
      case 240:
        this.branch(this.fZ === 1);
        break;
      case 47:
        this.branch(true);
        break;
      case 3:
      case 35:
      case 67:
      case 99:
      case 131:
      case 163:
      case 195:
      case 227:
        this.branchBit(true);
        break;
      case 19:
      case 51:
      case 83:
      case 115:
      case 147:
      case 179:
      case 211:
      case 243:
        this.branchBit(false);
        break;
      case 46: {
        const v = this.readDP(this.fetch());
        this.branch(this.A !== v);
        break;
      }
      case 222: {
        const v = this.readDP(this.fetch() + this.X);
        this.branch(this.A !== v);
        break;
      }
      case 110: {
        const d = this.fetch();
        const v = this.readDP(d) - 1 & 255;
        this.writeDP(d, v);
        this.branch(v !== 0);
        break;
      }
      case 254:
        this.Y = this.Y - 1 & 255;
        this.branch(this.Y !== 0);
        break;
      case 95:
        this.PC = this.fetch16();
        break;
      case 31:
        this.PC = this.read16(this.fetch16() + this.X & 65535);
        break;
      case 63: {
        const a = this.fetch16();
        this.push16(this.PC);
        this.PC = a;
        break;
      }
      case 79: {
        const u = this.fetch();
        this.push16(this.PC);
        this.PC = 65280 | u;
        break;
      }
      case 111:
        this.PC = this.pop16();
        break;
      case 127:
        this.PSW = this.pop();
        this.PC = this.pop16();
        break;
      case 1:
      case 17:
      case 33:
      case 49:
      case 65:
      case 81:
      case 97:
      case 113:
      case 129:
      case 145:
      case 161:
      case 177:
      case 193:
      case 209:
      case 225:
      case 241: {
        const n = op >> 4;
        this.push16(this.PC);
        this.PC = this.read16(65502 - n * 2);
        break;
      }
      case 15:
        this.push16(this.PC);
        this.push(this.PSW);
        this.fB = 1;
        this.fI = 0;
        this.PC = this.read16(65502);
        break;
      case 2:
      case 34:
      case 66:
      case 98:
      case 130:
      case 162:
      case 194:
      case 226: {
        const d = this.fetch();
        this.writeDP(d, this.readDP(d) | 1 << (op >> 5));
        break;
      }
      case 18:
      case 50:
      case 82:
      case 114:
      case 146:
      case 178:
      case 210:
      case 242: {
        const d = this.fetch();
        this.writeDP(d, this.readDP(d) & ~(1 << (op >> 5)));
        break;
      }
      case 10: {
        const { addr, bit } = this.bitOperand();
        this.fC |= this.read(addr) >> bit & 1;
        break;
      }
      case 42: {
        const { addr, bit } = this.bitOperand();
        this.fC |= ~(this.read(addr) >> bit) & 1;
        break;
      }
      case 74: {
        const { addr, bit } = this.bitOperand();
        this.fC &= this.read(addr) >> bit & 1;
        break;
      }
      case 106: {
        const { addr, bit } = this.bitOperand();
        this.fC &= ~(this.read(addr) >> bit) & 1;
        break;
      }
      case 138: {
        const { addr, bit } = this.bitOperand();
        this.fC ^= this.read(addr) >> bit & 1;
        break;
      }
      case 170: {
        const { addr, bit } = this.bitOperand();
        this.fC = this.read(addr) >> bit & 1;
        break;
      }
      case 202: {
        const { addr, bit } = this.bitOperand();
        const v = this.read(addr);
        this.write(addr, this.fC ? v | 1 << bit : v & ~(1 << bit));
        break;
      }
      case 234: {
        const { addr, bit } = this.bitOperand();
        this.write(addr, this.read(addr) ^ 1 << bit);
        break;
      }
      case 14: {
        const a = this.fetch16();
        const v = this.read(a);
        this.setNZ(this.A - v);
        this.write(a, v | this.A);
        break;
      }
      case 78: {
        const a = this.fetch16();
        const v = this.read(a);
        this.setNZ(this.A - v);
        this.write(a, v & ~this.A);
        break;
      }
      case 32:
        this.fP = 0;
        break;
      case 64:
        this.fP = 1;
        break;
      case 96:
        this.fC = 0;
        break;
      case 128:
        this.fC = 1;
        break;
      case 160:
        this.fI = 1;
        break;
      case 192:
        this.fI = 0;
        break;
      case 224:
        this.fV = 0;
        this.fH = 0;
        break;
      case 237:
        this.fC ^= 1;
        break;
      case 0:
        break;
      case 159:
        this.A = this.setNZ(this.A >> 4 | this.A << 4);
        break;
      case 207: {
        const r = this.Y * this.A;
        this.A = r & 255;
        this.Y = r >> 8 & 255;
        this.setNZ(this.Y);
        break;
      }
      case 158:
        this.divide();
        break;
      case 223:
        this.daa();
        break;
      case 190:
        this.das();
        break;
      case 239:
      case 255:
        this.halted = true;
        break;
      default:
        throw new Error(`unimplemented SPC700 opcode $${op.toString(16)}`);
    }
    return this.lastCycles;
  }
  dpDP(fn) {
    const src = this.readDP(this.fetch());
    const d = this.fetch();
    this.writeDP(d, fn(src, this.readDP(d)));
  }
  dpImm(fn) {
    const imm = this.fetch();
    const d = this.fetch();
    this.writeDP(d, fn(imm, this.readDP(d)));
  }
  xy(fn) {
    const y = this.readDP(this.Y);
    const x = this.readDP(this.X);
    this.writeDP(this.X, fn(x, y));
  }
  dpDPCmp() {
    const src = this.readDP(this.fetch());
    const dst = this.readDP(this.fetch());
    this.cmp(dst, src);
  }
  dpImmCmp() {
    const imm = this.fetch();
    const dst = this.readDP(this.fetch());
    this.cmp(dst, imm);
  }
  rmw(fn, addr) {
    this.write(addr, fn(this.read(addr)));
  }
  rmwDP(fn, offset) {
    this.writeDP(offset, fn(this.readDP(offset)));
  }
  divide() {
    const ya = this.YA;
    this.fH = (this.X & 15) <= (this.Y & 15) ? 1 : 0;
    this.fV = this.Y >= this.X ? 1 : 0;
    if (this.X === 0) {
      this.A = 255;
      this.Y = 255;
    } else if (this.Y < this.X << 1) {
      this.A = ya / this.X | 0;
      this.Y = ya % this.X;
    } else {
      const t = ya - (this.X << 9);
      this.A = 255 - (t / (256 - this.X) | 0);
      this.Y = this.X + t % (256 - this.X);
    }
    this.A &= 255;
    this.Y &= 255;
    this.setNZ(this.A);
  }
  daa() {
    if (this.fC || this.A > 153) {
      this.A += 96;
      this.fC = 1;
    }
    if (this.fH || (this.A & 15) > 9) {
      this.A += 6;
    }
    this.A = this.setNZ(this.A);
  }
  das() {
    if (!this.fC || this.A > 153) {
      this.A -= 96;
      this.fC = 0;
    }
    if (!this.fH || (this.A & 15) > 9) {
      this.A -= 6;
    }
    this.A = this.setNZ(this.A & 255);
  }
};

// upstream/src/gaussian.ts
function constructTable() {
  const table = new Float64Array(512);
  for (let n = 0; n < 512; n++) {
    const k = 0.5 + n;
    const s = Math.sin(Math.PI * k * 1.28 / 1024);
    const t = (Math.cos(Math.PI * k * 2 / 1023) - 1) * 0.5;
    const u = (Math.cos(Math.PI * k * 4 / 1023) - 1) * 0.08;
    table[511 - n] = s * (t + u + 1) / k;
  }
  const out = new Int16Array(512);
  for (let phase = 0; phase < 128; phase++) {
    const idx = [phase, phase + 256, 511 - phase, 255 - phase];
    let sum = 0;
    for (const i of idx)
      sum += table[i];
    const scale = 2048 / sum;
    for (const i of idx)
      out[i] = Math.floor(table[i] * scale + 0.5);
  }
  return out;
}
var GAUSS_TABLE = constructTable();
function setGaussianTable(table) {
  if (table.length !== 512) {
    throw new Error(`gaussian table must have 512 entries, got ${table.length}`);
  }
  GAUSS_TABLE = Int16Array.from(table);
}

// upstream/src/dsp.ts
var DSP_SAMPLE_RATE = 32e3;
var VOL_L = 0;
var VOL_R = 1;
var PITCH_L = 2;
var PITCH_H = 3;
var SRCN = 4;
var ADSR1 = 5;
var ADSR2 = 6;
var GAIN = 7;
var ENVX = 8;
var OUTX = 9;
var R_MVOL_L = 12;
var R_MVOL_R = 28;
var R_EVOL_L = 44;
var R_EVOL_R = 60;
var R_KON = 76;
var R_KOF = 92;
var R_FLG = 108;
var R_ENDX = 124;
var R_EFB = 13;
var R_PMON = 45;
var R_NON = 61;
var R_EON = 77;
var R_DIR = 93;
var R_ESA = 109;
var R_EDL = 125;
var COUNTER_RATE = new Uint16Array([
  0,
  2048,
  1536,
  1280,
  1024,
  768,
  640,
  512,
  384,
  320,
  256,
  192,
  160,
  128,
  96,
  80,
  64,
  48,
  40,
  32,
  24,
  20,
  16,
  12,
  10,
  8,
  6,
  5,
  4,
  3,
  2,
  1
]);
var COUNTER_OFFSET = new Uint16Array([
  0,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  536,
  0,
  1040,
  0,
  0
]);
var COUNTER_RANGE = 30720;
var PITCH_ONE = 4096;
var EnvMode;
(function(EnvMode3) {
  EnvMode3[EnvMode3["Release"] = 0] = "Release";
  EnvMode3[EnvMode3["Attack"] = 1] = "Attack";
  EnvMode3[EnvMode3["Decay"] = 2] = "Decay";
  EnvMode3[EnvMode3["Sustain"] = 3] = "Sustain";
})(EnvMode || (EnvMode = {}));
function clamp16(v) {
  return v < -32768 ? -32768 : v > 32767 ? 32767 : v;
}
function sext16(v) {
  return v << 16 >> 16;
}
var Voice = class {
  constructor() {
    this.buffer = new Int32Array(12);
    this.bufferPos = 0;
    this.decoded = 0;
    this.brrAddress = 0;
    this.brrOffset = 1;
    this.brrHeader = 0;
    this.envelope = 0;
    this.hiddenEnvelope = 0;
    this.envelopeMode = 0;
    this.keyonDelay = 0;
    this.gaussianOffset = 0;
    this.outx = 0;
    this.keyOnAt = 0;
    this.keyOnCount = 0;
  }
  reset() {
    this.buffer.fill(0);
    this.bufferPos = 0;
    this.decoded = 0;
    this.brrAddress = 0;
    this.brrOffset = 1;
    this.brrHeader = 0;
    this.envelope = 0;
    this.hiddenEnvelope = 0;
    this.envelopeMode = 0;
    this.keyonDelay = 0;
    this.gaussianOffset = 0;
    this.outx = 0;
    this.keyOnAt = 0;
    this.keyOnCount = 0;
  }
};
var DSP = class {
  constructor(ram) {
    this.ram = ram;
    this.regs = new Uint8Array(128);
    this.voices = [];
    this.voiceMask = 0;
    this.echoMask = 0;
    this.sampleCount = 0;
    this.noteOnEvents = [];
    this.voiceOut = new Int16Array(8);
    this.counter = 0;
    this.noise = 16384;
    this.konLatch = 0;
    this.konPending = 0;
    this.echoOffset = 0;
    this.echoLength = 0;
    this.firL = new Int32Array(8);
    this.firR = new Int32Array(8);
    this.firIndex = 0;
    for (let i = 0; i < 8; i++)
      this.voices.push(new Voice());
    this.reset();
  }
  reset() {
    this.regs.fill(0);
    this.regs[R_FLG] = 224;
    for (const v of this.voices)
      v.reset();
    this.sampleCount = 0;
    this.counter = 0;
    this.noise = 16384;
    this.konLatch = 0;
    this.konPending = 0;
    this.echoOffset = 0;
    this.echoLength = 0;
    this.firL.fill(0);
    this.firR.fill(0);
    this.firIndex = 0;
  }
  read(addr) {
    return this.regs[addr & 127];
  }
  write(addr, value) {
    addr &= 127;
    value &= 255;
    this.regs[addr] = value;
    if (addr === R_KON) {
      this.konLatch = value;
    } else if (addr === R_ENDX) {
      this.regs[R_ENDX] = 0;
    }
  }
  counterTick() {
    if (--this.counter < 0)
      this.counter = COUNTER_RANGE - 1;
  }
  counterPoll(rate) {
    if (rate === 0)
      return false;
    return (this.counter + COUNTER_OFFSET[rate]) % COUNTER_RATE[rate] === 0;
  }
  dirEntry(srcn, which) {
    const a = (this.regs[R_DIR] << 8) + srcn * 4 + which * 2 & 65535;
    return this.ram[a] | this.ram[a + 1 & 65535] << 8;
  }
  decodeGroup(v, index) {
    const header = this.ram[v.brrAddress];
    v.brrHeader = header;
    const shift = header >> 4;
    const filter = header >> 2 & 3;
    const b0 = this.ram[v.brrAddress + v.brrOffset & 65535];
    const b1 = this.ram[v.brrAddress + v.brrOffset + 1 & 65535];
    const nibbles = [b0 >> 4, b0 & 15, b1 >> 4, b1 & 15];
    for (let n = 0; n < 4; n++) {
      let s = nibbles[n] << 28 >> 28;
      if (shift <= 12) {
        s = s << shift >> 1;
      } else {
        s = s >> 3 << 11;
      }
      const wp = (v.bufferPos + v.decoded) % 12;
      const p1 = v.buffer[(wp + 11) % 12];
      const p2 = v.buffer[(wp + 10) % 12] >> 1;
      switch (filter) {
        case 1:
          s += p1 >> 1;
          s += -p1 >> 5;
          break;
        case 2:
          s += p1;
          s += -(p1 + (p1 >> 1)) >> 5;
          s -= p2;
          s += p2 >> 4;
          break;
        case 3:
          s += p1;
          s += -(p1 + (p1 << 2) + (p1 << 3)) >> 7;
          s -= p2;
          s += p2 + (p2 << 1) >> 4;
          break;
      }
      v.buffer[wp] = sext16(clamp16(s) * 2);
      v.decoded++;
    }
    v.brrOffset += 2;
    if (v.brrOffset >= 9) {
      v.brrOffset = 1;
      v.brrAddress = v.brrAddress + 9 & 65535;
      if (header & 1) {
        this.regs[R_ENDX] |= 1 << index;
        if (header & 2) {
          v.brrAddress = this.dirEntry(this.regs[index << 4 | SRCN], 1);
        } else {
          v.envelope = 0;
          v.envelopeMode = 0;
        }
      }
    }
  }
  gaussianInterpolate(v) {
    const off = v.gaussianOffset >> 4 & 255;
    let i = v.bufferPos;
    let out = GAUSS_TABLE[255 - off] * v.buffer[i] >> 11;
    i = i === 11 ? 0 : i + 1;
    out += GAUSS_TABLE[511 - off] * v.buffer[i] >> 11;
    i = i === 11 ? 0 : i + 1;
    out += GAUSS_TABLE[256 + off] * v.buffer[i] >> 11;
    i = i === 11 ? 0 : i + 1;
    out = sext16(out);
    out += GAUSS_TABLE[off] * v.buffer[i] >> 11;
    return clamp16(out) & ~1;
  }
  envelopeRun(v, base) {
    let env = v.envelope;
    if (v.envelopeMode === 0) {
      env -= 8;
      v.envelope = env < 0 ? 0 : env;
      return;
    }
    let rate;
    let envData = this.regs[base + ADSR2];
    const adsr1 = this.regs[base + ADSR1];
    if (adsr1 & 128) {
      if (v.envelopeMode === 2) {
        env--;
        env -= env >> 8;
        rate = (adsr1 >> 3 & 14) + 16;
      } else if (v.envelopeMode === 3) {
        env--;
        env -= env >> 8;
        rate = envData & 31;
      } else {
        rate = (adsr1 & 15) * 2 + 1;
        env += rate < 31 ? 32 : 1024;
      }
    } else {
      envData = this.regs[base + GAIN];
      const mode = envData >> 5;
      if (mode < 4) {
        env = (envData & 127) * 16;
        rate = 31;
      } else {
        rate = envData & 31;
        if (mode === 4) {
          env -= 32;
        } else if (mode === 5) {
          env--;
          env -= env >> 8;
        } else if (mode === 6) {
          env += 32;
        } else {
          env += v.hiddenEnvelope < 1536 ? 32 : 8;
        }
      }
    }
    if (env >> 8 === envData >> 5 && v.envelopeMode === 2) {
      v.envelopeMode = 3;
    }
    v.hiddenEnvelope = env;
    if (env < 0 || env > 2047) {
      env = env < 0 ? 0 : 2047;
      if (v.envelopeMode === 1)
        v.envelopeMode = 2;
    }
    if (this.counterPoll(rate))
      v.envelope = env;
  }
  runSample(out) {
    const flg = this.regs[R_FLG];
    const softReset = (flg & 128) !== 0;
    this.counterTick();
    if (this.counterPoll(flg & 31)) {
      const feedback = this.noise << 13 ^ this.noise << 14;
      this.noise = feedback & 16384 | this.noise >> 1;
    }
    const kon = this.konPending;
    this.konPending = this.konLatch;
    this.konLatch = 0;
    const kof = this.regs[R_KOF];
    let mainL = 0;
    let mainR = 0;
    let echoInL = 0;
    let echoInR = 0;
    for (let i = 0; i < 8; i++) {
      const v = this.voices[i];
      const base = i << 4;
      const bit = 1 << i;
      if (kon & bit) {
        v.keyonDelay = 5;
        v.envelopeMode = 0;
        v.keyOnAt = this.sampleCount;
        v.keyOnCount++;
      }
      if (softReset || kof & bit) {
        v.envelopeMode = 0;
        if (softReset)
          v.envelope = 0;
      }
      if (v.keyonDelay > 0) {
        if (v.keyonDelay === 5) {
          v.brrAddress = this.dirEntry(this.regs[base + SRCN], 0);
          v.brrOffset = 1;
          v.bufferPos = 0;
          v.decoded = 0;
          v.buffer.fill(0);
          v.brrHeader = 0;
          this.regs[R_ENDX] &= ~bit;
        }
        v.envelope = 0;
        v.hiddenEnvelope = 0;
        v.keyonDelay--;
        v.gaussianOffset = 0;
        if (v.keyonDelay === 0) {
          v.envelopeMode = 1;
          if (this.noteOnEvents.length < 4096) {
            this.noteOnEvents.push(this.regs[base + SRCN], this.pitchOf(i));
          }
        }
        v.outx = 0;
        this.voiceOut[i] = 0;
        this.regs[base + ENVX] = 0;
        this.regs[base + OUTX] = 0;
        continue;
      }
      while (v.decoded < 4)
        this.decodeGroup(v, i);
      let sample;
      if (this.regs[R_NON] & bit) {
        sample = sext16(this.noise << 1);
      } else {
        sample = this.gaussianInterpolate(v);
      }
      this.envelopeRun(v, base);
      sample = sample * v.envelope >> 11 & ~1;
      v.outx = sample;
      this.voiceOut[i] = sample;
      this.regs[base + ENVX] = v.envelope >> 4;
      this.regs[base + OUTX] = sample >> 8 & 255;
      if (!(this.voiceMask & bit)) {
        mainL = clamp16(mainL + (sample * (this.regs[base + VOL_L] << 24 >> 24) >> 7));
        mainR = clamp16(mainR + (sample * (this.regs[base + VOL_R] << 24 >> 24) >> 7));
      }
      if (this.regs[R_EON] & bit & ~this.echoMask & ~this.voiceMask) {
        echoInL = clamp16(echoInL + (sample * (this.regs[base + VOL_L] << 24 >> 24) >> 7));
        echoInR = clamp16(echoInR + (sample * (this.regs[base + VOL_R] << 24 >> 24) >> 7));
      }
      let step = this.regs[base + PITCH_L] | (this.regs[base + PITCH_H] & 63) << 8;
      if (i > 0 && this.regs[R_PMON] & bit) {
        const prev = this.voices[i - 1].outx;
        step += (prev >> 5) * step >> 10;
        if (step < 0)
          step = 0;
        if (step > 16383)
          step = 16383;
      }
      v.gaussianOffset += step;
      while (v.gaussianOffset >= PITCH_ONE) {
        v.gaussianOffset -= PITCH_ONE;
        v.bufferPos = v.bufferPos === 11 ? 0 : v.bufferPos + 1;
        v.decoded--;
        while (v.decoded < 4)
          this.decodeGroup(v, i);
      }
    }
    if (this.echoOffset === 0) {
      this.echoLength = (this.regs[R_EDL] & 15) * 2048;
    }
    const ea = (this.regs[R_ESA] << 8) + this.echoOffset & 65535;
    const echoL = sext16(this.ram[ea] | this.ram[ea + 1 & 65535] << 8) >> 1;
    const echoR = sext16(this.ram[ea + 2 & 65535] | this.ram[ea + 3 & 65535] << 8) >> 1;
    this.firIndex = this.firIndex + 1 & 7;
    this.firL[this.firIndex] = echoL;
    this.firR[this.firIndex] = echoR;
    let firOutL = 0;
    let firOutR = 0;
    for (let t = 0; t < 7; t++) {
      const c = this.regs[t << 4 | 15] << 24 >> 24;
      const h = this.firIndex + 1 + t & 7;
      firOutL += this.firL[h] * c >> 6;
      firOutR += this.firR[h] * c >> 6;
    }
    firOutL = sext16(firOutL);
    firOutR = sext16(firOutR);
    {
      const c = this.regs[7 << 4 | 15] << 24 >> 24;
      firOutL = clamp16(firOutL + (this.firL[this.firIndex] * c >> 6)) & ~1;
      firOutR = clamp16(firOutR + (this.firR[this.firIndex] * c >> 6)) & ~1;
    }
    if (!(flg & 32)) {
      const efb = this.regs[R_EFB] << 24 >> 24;
      const wL = clamp16(echoInL + (firOutL * efb >> 7)) & ~1;
      const wR = clamp16(echoInR + (firOutR * efb >> 7)) & ~1;
      this.ram[ea] = wL & 255;
      this.ram[ea + 1 & 65535] = wL >> 8 & 255;
      this.ram[ea + 2 & 65535] = wR & 255;
      this.ram[ea + 3 & 65535] = wR >> 8 & 255;
    }
    this.echoOffset += 4;
    if (this.echoOffset >= this.echoLength)
      this.echoOffset = 0;
    let outL = clamp16((mainL * (this.regs[R_MVOL_L] << 24 >> 24) >> 7) + (firOutL * (this.regs[R_EVOL_L] << 24 >> 24) >> 7));
    let outR = clamp16((mainR * (this.regs[R_MVOL_R] << 24 >> 24) >> 7) + (firOutR * (this.regs[R_EVOL_R] << 24 >> 24) >> 7));
    if (flg & 64) {
      outL = 0;
      outR = 0;
    }
    out[0] = outL;
    out[1] = outR;
    this.sampleCount++;
  }
  restoreFromSnapshot(resumeVoices) {
    this.counter = 0;
    this.noise = 16384;
    this.echoOffset = 0;
    this.echoLength = 0;
    this.firL.fill(0);
    this.firR.fill(0);
    this.firIndex = 0;
    this.sampleCount = 0;
    this.konLatch = 0;
    const kon = this.regs[R_KON];
    const kof = this.regs[R_KOF];
    let pending = 0;
    const resumeAt = (i, envelope) => {
      const v = this.voices[i];
      const base = i << 4;
      const srcn = this.regs[base + SRCN];
      v.envelope = Math.min(2047, envelope);
      v.hiddenEnvelope = v.envelope;
      v.envelopeMode = 3;
      v.brrAddress = this.dirEntry(srcn, 1);
      v.brrOffset = 1;
      v.bufferPos = 0;
      v.decoded = 0;
      v.gaussianOffset = 0;
    };
    for (let i = 0; i < 8; i++) {
      const base = i << 4;
      const bit = 1 << i;
      const capturedEnv = this.regs[base + ENVX];
      this.voices[i].reset();
      this.regs[base + ENVX] = 0;
      this.regs[base + OUTX] = 0;
      if (kof & bit)
        continue;
      if (resumeVoices && capturedEnv > 0) {
        resumeAt(i, capturedEnv << 4);
        continue;
      }
      if (kon & bit)
        pending |= bit;
    }
    this.konPending = 0;
    return pending;
  }
  applyKeyOnRecovery(mask) {
    let pending = 0;
    for (let i = 0; i < 8; i++) {
      const bit = 1 << i;
      if (!(mask & bit))
        continue;
      const base = i << 4;
      const adsr1 = this.regs[base + ADSR1];
      const gainMode = this.regs[base + GAIN] >> 5;
      if (!(adsr1 & 128) && (gainMode === 4 || gainMode === 5)) {
        const v = this.voices[i];
        v.envelope = 2047;
        v.hiddenEnvelope = 2047;
        v.envelopeMode = 3;
        v.brrAddress = this.dirEntry(this.regs[base + SRCN], 0);
        v.brrOffset = 1;
        v.bufferPos = 0;
        v.decoded = 0;
        v.gaussianOffset = 0;
      } else {
        pending |= bit;
      }
    }
    this.konPending = pending;
  }
  envelopeOf(index) {
    return this.voices[index].envelope;
  }
  isActive(index) {
    const v = this.voices[index];
    return v.keyonDelay > 0 || v.envelope > 0;
  }
  pitchOf(index) {
    const base = index << 4;
    return this.regs[base + PITCH_L] | (this.regs[base + PITCH_H] & 63) << 8;
  }
};

// upstream/src/apu.ts
var CPU_CLOCK = 1024e3;
var CYCLES_PER_SAMPLE = 32;
var VOICE_FIELDS = 13;
var Timer = class {
  constructor(period) {
    this.period = period;
    this.enabled = false;
    this.target = 0;
    this.divider = 0;
    this.stage = 0;
    this.out = 0;
  }
  setEnabled(on) {
    if (on && !this.enabled) {
      this.stage = 0;
      this.out = 0;
    }
    this.enabled = on;
  }
  step(cycles) {
    this.divider += cycles;
    while (this.divider >= this.period) {
      this.divider -= this.period;
      if (!this.enabled)
        continue;
      if (++this.stage >= (this.target === 0 ? 256 : this.target)) {
        this.stage = 0;
        this.out = this.out + 1 & 15;
      }
    }
  }
};
var SPCAPU = class {
  constructor() {
    this.ram = new Uint8Array(65536);
    this.dsp = new DSP(this.ram);
    this.cpu = new SPC700(this);
    this.iplRom = new Uint8Array(64);
    this.control = 0;
    this.dspAddr = 0;
    this.inputPorts = new Uint8Array(4);
    this.outputPorts = new Uint8Array(4);
    this.timers = [new Timer(128), new Timer(128), new Timer(16)];
    this.cycleDebt = 0;
    this.sampleOut = new Int32Array(2);
  }
  reset() {
    this.ram.fill(0);
    this.dsp.reset();
    this.control = 0;
    this.dspAddr = 0;
    this.inputPorts.fill(0);
    this.outputPorts.fill(0);
    for (const t of this.timers) {
      t.enabled = false;
      t.target = 0;
      t.divider = 0;
      t.stage = 0;
      t.out = 0;
    }
    this.cycleDebt = 0;
    this.cpu.reset();
  }
  read(addr) {
    if ((addr & 65520) === 240) {
      switch (addr & 15) {
        case 0:
          return 0;
        case 1:
          return this.control;
        case 2:
          return this.dspAddr;
        case 3:
          return this.dsp.read(this.dspAddr & 127);
        case 4:
        case 5:
        case 6:
        case 7:
          return this.inputPorts[(addr & 15) - 4];
        case 8:
        case 9:
          return this.ram[addr];
        case 10:
        case 11:
        case 12:
          return 0;
        case 13:
        case 14:
        case 15: {
          const t = this.timers[(addr & 15) - 13];
          const v = t.out;
          t.out = 0;
          return v;
        }
      }
    }
    if (addr >= 65472 && this.control & 128) {
      return this.iplRom[addr - 65472];
    }
    return this.ram[addr];
  }
  write(addr, value) {
    if ((addr & 65520) === 240) {
      switch (addr & 15) {
        case 0:
          return;
        case 1:
          this.control = value;
          this.timers[0].setEnabled((value & 1) !== 0);
          this.timers[1].setEnabled((value & 2) !== 0);
          this.timers[2].setEnabled((value & 4) !== 0);
          if (value & 16) {
            this.inputPorts[0] = 0;
            this.inputPorts[1] = 0;
          }
          if (value & 32) {
            this.inputPorts[2] = 0;
            this.inputPorts[3] = 0;
          }
          return;
        case 2:
          this.dspAddr = value;
          return;
        case 3:
          if (!(this.dspAddr & 128))
            this.dsp.write(this.dspAddr & 127, value);
          return;
        case 4:
        case 5:
        case 6:
        case 7:
          this.outputPorts[(addr & 15) - 4] = value;
          return;
        case 8:
        case 9:
          this.ram[addr] = value;
          return;
        case 10:
        case 11:
        case 12:
          this.timers[(addr & 15) - 10].target = value;
          return;
        default:
          return;
      }
    }
    this.ram[addr] = value;
  }
  renderSample(out) {
    while (this.cycleDebt < CYCLES_PER_SAMPLE) {
      const c = this.cpu.step();
      this.cycleDebt += c;
      this.timers[0].step(c);
      this.timers[1].step(c);
      this.timers[2].step(c);
    }
    this.cycleDebt -= CYCLES_PER_SAMPLE;
    this.dsp.runSample(out);
  }
  skipSamples(count) {
    for (let i = 0; i < count; i++)
      this.renderSample(this.sampleOut);
  }
  saveState() {
    const cpu = Int32Array.of(this.cpu.A, this.cpu.X, this.cpu.Y, this.cpu.SP, this.cpu.PC, this.cpu.PSW, this.cpu.halted ? 1 : 0, this.cycleDebt);
    const d = this.dsp;
    const dspState = Int32Array.of(d.counter, d.noise, d.konLatch, d.konPending, d.echoOffset, d.echoLength, d.firIndex, this.dsp.voiceMask, this.dsp.echoMask, this.dsp.sampleCount);
    const fir = this.dsp;
    const firBase = dspState.length;
    const dspFull = new Int32Array(firBase + 16);
    dspFull.set(dspState);
    dspFull.set(fir.firL, firBase);
    dspFull.set(fir.firR, firBase + 8);
    const voices = new Int32Array(8 * VOICE_FIELDS);
    const voiceBuffers = new Int32Array(8 * 12);
    for (let i = 0; i < 8; i++) {
      const v = this.dsp.voices[i];
      voices.set([
        v.bufferPos,
        v.decoded,
        v.brrAddress,
        v.brrOffset,
        v.brrHeader,
        v.envelope,
        v.hiddenEnvelope,
        v.envelopeMode,
        v.keyonDelay,
        v.gaussianOffset,
        v.outx,
        v.keyOnAt,
        v.keyOnCount
      ], i * VOICE_FIELDS);
      voiceBuffers.set(v.buffer, i * 12);
    }
    const timers = new Int32Array(3 * 5);
    for (let i = 0; i < 3; i++) {
      const t = this.timers[i];
      timers.set([t.enabled ? 1 : 0, t.target, t.divider, t.stage, t.out], i * 5);
    }
    const io = Int32Array.of(this.control, this.dspAddr, this.inputPorts[0], this.inputPorts[1], this.inputPorts[2], this.inputPorts[3], this.outputPorts[0], this.outputPorts[1], this.outputPorts[2], this.outputPorts[3]);
    return {
      ram: this.ram.slice(),
      dspRegs: this.dsp.regs.slice(),
      cpu,
      dsp: dspFull,
      voices,
      voiceBuffers,
      timers,
      io
    };
  }
  loadState(s) {
    this.ram.set(s.ram);
    this.dsp.regs.set(s.dspRegs);
    this.cpu.A = s.cpu[0];
    this.cpu.X = s.cpu[1];
    this.cpu.Y = s.cpu[2];
    this.cpu.SP = s.cpu[3];
    this.cpu.PC = s.cpu[4];
    this.cpu.PSW = s.cpu[5];
    this.cpu.halted = s.cpu[6] !== 0;
    this.cycleDebt = s.cpu[7];
    const d = this.dsp;
    d.counter = s.dsp[0];
    d.noise = s.dsp[1];
    d.konLatch = s.dsp[2];
    d.konPending = s.dsp[3];
    d.echoOffset = s.dsp[4];
    d.echoLength = s.dsp[5];
    d.firIndex = s.dsp[6];
    this.dsp.voiceMask = s.dsp[7];
    this.dsp.echoMask = s.dsp[8];
    this.dsp.sampleCount = s.dsp[9];
    const fir = this.dsp;
    fir.firL.set(s.dsp.subarray(10, 18));
    fir.firR.set(s.dsp.subarray(18, 26));
    for (let i = 0; i < 8; i++) {
      const v = this.dsp.voices[i];
      const o = i * VOICE_FIELDS;
      v.bufferPos = s.voices[o + 0];
      v.decoded = s.voices[o + 1];
      v.brrAddress = s.voices[o + 2];
      v.brrOffset = s.voices[o + 3];
      v.brrHeader = s.voices[o + 4];
      v.envelope = s.voices[o + 5];
      v.hiddenEnvelope = s.voices[o + 6];
      v.envelopeMode = s.voices[o + 7];
      v.keyonDelay = s.voices[o + 8];
      v.gaussianOffset = s.voices[o + 9];
      v.outx = s.voices[o + 10];
      v.keyOnAt = s.voices[o + 11];
      v.keyOnCount = s.voices[o + 12];
      v.buffer.set(s.voiceBuffers.subarray(i * 12, i * 12 + 12));
    }
    for (let i = 0; i < 3; i++) {
      const t = this.timers[i];
      const o = i * 5;
      t.enabled = s.timers[o + 0] !== 0;
      t.target = s.timers[o + 1];
      t.divider = s.timers[o + 2];
      t.stage = s.timers[o + 3];
      t.out = s.timers[o + 4];
    }
    this.control = s.io[0];
    this.dspAddr = s.io[1];
    for (let i = 0; i < 4; i++) {
      this.inputPorts[i] = s.io[2 + i];
      this.outputPorts[i] = s.io[6 + i];
    }
  }
  applyRegisterBlock() {
    this.control = this.ram[241];
    this.dspAddr = this.ram[242];
    for (let i = 0; i < 4; i++)
      this.inputPorts[i] = this.ram[244 + i];
    for (let i = 0; i < 3; i++) {
      const t = this.timers[i];
      t.target = this.ram[250 + i];
      t.enabled = (this.control & 1 << i) !== 0;
      t.stage = 0;
      t.out = this.ram[253 + i] & 15;
      t.divider = 0;
    }
  }
};

// upstream/src/resampler.ts
var TAPS = 32;
var PHASES = 256;
var HALF = TAPS / 2;
function blackman(x) {
  const t = (x + 1) / 2;
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * t) + 0.08 * Math.cos(4 * Math.PI * t);
}
function sinc(x) {
  if (x === 0)
    return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}
function buildKernel(cutoff) {
  const kernel = new Float32Array(PHASES * TAPS);
  for (let p = 0; p < PHASES; p++) {
    const frac = p / PHASES;
    let sum = 0;
    for (let j = 0; j < TAPS; j++) {
      const x = j - HALF + 1 - frac;
      const v = 2 * cutoff * sinc(2 * cutoff * x) * blackman(x / HALF);
      kernel[p * TAPS + j] = v;
      sum += v;
    }
    const scale = 1 / sum;
    for (let j = 0; j < TAPS; j++)
      kernel[p * TAPS + j] *= scale;
  }
  return kernel;
}
var RING = 64;
var RING_MASK = RING - 1;
var Resampler = class {
  constructor(inputRate, outputRate) {
    this.ringL = new Float32Array(RING);
    this.ringR = new Float32Array(RING);
    this.pulled = new Int32Array(2);
    this.written = 0;
    this.position = 0;
    this.ratio = inputRate / outputRate;
    const cutoff = 0.5 * Math.min(1, outputRate / inputRate);
    this.kernel = buildKernel(cutoff);
    this.reset();
  }
  reset() {
    this.ringL.fill(0);
    this.ringR.fill(0);
    this.written = HALF - 1;
    this.position = HALF - 1;
  }
  process(outL, outR, offset, count, source) {
    const { kernel, ringL, ringR, pulled } = this;
    for (let n = 0; n < count; n++) {
      const base = Math.floor(this.position);
      const highest = base + HALF;
      while (this.written <= highest) {
        source(pulled);
        const i = this.written & RING_MASK;
        ringL[i] = pulled[0];
        ringR[i] = pulled[1];
        this.written++;
      }
      const phase = (this.position - base) * PHASES | 0;
      const k = phase * TAPS;
      const start = base - HALF + 1;
      let l = 0;
      let r = 0;
      for (let j = 0; j < TAPS; j++) {
        const idx = start + j & RING_MASK;
        const c = kernel[k + j];
        l += ringL[idx] * c;
        r += ringR[idx] * c;
      }
      outL[offset + n] = l < -32768 ? -32768 : l > 32767 ? 32767 : l | 0;
      outR[offset + n] = r < -32768 ? -32768 : r > 32767 ? 32767 : r | 0;
      this.position += this.ratio;
    }
    if (this.position > 1 << 28) {
      const shift = Math.floor(this.position / RING) * RING;
      this.position -= shift;
      this.written -= shift;
    }
  }
  skip(count, source) {
    const { pulled } = this;
    for (let n = 0; n < count; n++) {
      const highest = Math.floor(this.position) + HALF;
      while (this.written <= highest) {
        source(pulled);
        const i = this.written & RING_MASK;
        this.ringL[i] = pulled[0];
        this.ringR[i] = pulled[1];
        this.written++;
      }
      this.position += this.ratio;
    }
    if (this.position > 1 << 28) {
      const shift = Math.floor(this.position / RING) * RING;
      this.position -= shift;
      this.written -= shift;
    }
  }
  get inputConsumed() {
    return this.written - (HALF - 1);
  }
  saveState() {
    const out = new Float64Array(2 + RING * 2);
    out[0] = this.written;
    out[1] = this.position;
    out.set(this.ringL, 2);
    out.set(this.ringR, 2 + RING);
    return out;
  }
  loadState(state) {
    this.written = state[0];
    this.position = state[1];
    for (let i = 0; i < RING; i++) {
      this.ringL[i] = state[2 + i];
      this.ringR[i] = state[2 + RING + i];
    }
  }
};

// upstream/src/spc-file.ts
var SIGNATURE = "SNES-SPC700 Sound File Data";
var XID6_TICKS_PER_SECOND = 64e3;
function makeDecoder() {
  for (const label of ["shift_jis", "windows-1252"]) {
    try {
      const dec = new TextDecoder(label);
      return (bytes) => dec.decode(bytes);
    } catch {
    }
  }
  return (bytes) => String.fromCharCode(...bytes);
}
var decode = makeDecoder();
function readText(data, offset, length) {
  let end = offset;
  const limit = Math.min(offset + length, data.length);
  while (end < limit && data[end] !== 0)
    end++;
  return decode(data.subarray(offset, end)).replace(/\0+$/, "").trim();
}
function isTextField(data, offset, length) {
  for (let i = offset; i < offset + length && i < data.length; i++) {
    const c = data[i];
    if (c === 0 || c === 32)
      continue;
    if (c >= 48 && c <= 57)
      continue;
    return false;
  }
  return true;
}
function parseId666(data, tags) {
  tags.title = readText(data, 46, 32) || void 0;
  tags.game = readText(data, 78, 32) || void 0;
  tags.dumper = readText(data, 110, 16) || void 0;
  tags.comment = readText(data, 126, 32) || void 0;
  const binary = !isTextField(data, 169, 7);
  if (binary) {
    const y = data[158] | data[159] << 8;
    const m = data[160];
    const d = data[161];
    if (y || m || d)
      tags.date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const seconds = data[169] | data[170] << 8 | data[171] << 16;
    const fade = data[172] | data[173] << 8 | data[174] << 16 | data[175] << 24;
    if (seconds > 0)
      tags.playSeconds = seconds;
    if (fade > 0)
      tags.fadeMilliseconds = fade >>> 0;
    tags.artist = readText(data, 176, 32) || void 0;
    if (data[208])
      tags.mutedVoices = data[208];
  } else {
    tags.date = readText(data, 158, 11) || void 0;
    const seconds = parseInt(readText(data, 169, 3), 10);
    const fade = parseInt(readText(data, 172, 5), 10);
    if (Number.isFinite(seconds) && seconds > 0)
      tags.playSeconds = seconds;
    if (Number.isFinite(fade) && fade > 0)
      tags.fadeMilliseconds = fade;
    tags.artist = readText(data, 177, 32) || void 0;
    if (data[209])
      tags.mutedVoices = data[209];
  }
}
function parseXid6(data, tags) {
  const base = 66048;
  if (data.length < base + 8)
    return;
  if (String.fromCharCode(data[base], data[base + 1], data[base + 2], data[base + 3]) !== "xid6") {
    return;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const size = view.getUint32(base + 4, true);
  const end = Math.min(data.length, base + 8 + size);
  let p = base + 8;
  while (p + 4 <= end) {
    const id = data[p];
    const type = data[p + 1];
    const value = view.getUint16(p + 2, true);
    p += 4;
    let intValue = value;
    let strValue;
    if (type === 1) {
      strValue = readText(data, p, value);
      p += value + 3 & ~3;
    } else if (type === 4) {
      if (p + 4 > end)
        break;
      intValue = view.getUint32(p, true);
      p += value + 3 & ~3 || 4;
    }
    switch (id) {
      case 1:
        if (strValue)
          tags.title = strValue;
        break;
      case 2:
        if (strValue)
          tags.game = strValue;
        break;
      case 3:
        if (strValue)
          tags.artist = strValue;
        break;
      case 4:
        if (strValue)
          tags.dumper = strValue;
        break;
      case 7:
        if (strValue)
          tags.comment = strValue;
        break;
      case 16:
        if (strValue)
          tags.ostTitle = strValue;
        break;
      case 17:
        tags.ostDisc = intValue;
        break;
      case 18:
        tags.ostTrack = intValue >> 8 || intValue;
        break;
      case 19:
        if (strValue)
          tags.publisher = strValue;
        break;
      case 20:
        tags.copyrightYear = intValue;
        break;
      case 48:
        tags.introSeconds = intValue / XID6_TICKS_PER_SECOND;
        break;
      case 49:
        tags.loopSeconds = intValue / XID6_TICKS_PER_SECOND;
        break;
      case 50:
        tags.endSeconds = intValue / XID6_TICKS_PER_SECOND;
        break;
      case 51:
        tags.fadeMilliseconds = intValue / (XID6_TICKS_PER_SECOND / 1e3);
        break;
      case 52:
        tags.mutedVoices = intValue;
        break;
      case 53:
        tags.loopCount = intValue;
        break;
      case 54:
        tags.amplification = intValue;
        break;
    }
  }
}
function isSPCFile(data) {
  if (data.length < 65920)
    return false;
  return readText(data, 0, SIGNATURE.length).startsWith(SIGNATURE);
}
function parseSPC(input) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isSPCFile(data)) {
    throw new Error("not an SPC file (bad signature or truncated)");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const registers = {
    pc: view.getUint16(37, true),
    a: data[39],
    x: data[40],
    y: data[41],
    psw: data[42],
    sp: data[43]
  };
  const ram = data.slice(256, 256 + 65536);
  const dspRegs = data.slice(65792, 65920);
  const iplRom = new Uint8Array(64);
  if (data.length >= 66048)
    iplRom.set(data.subarray(65984, 66048));
  const tags = {};
  if (data[35] !== 27)
    parseId666(data, tags);
  parseXid6(data, tags);
  return { registers, ram, dspRegs, iplRom, tags };
}

// upstream/src/brr-analyzer.ts
var UNKNOWN = { hz: 0, confidence: 0, method: "unknown", loopLength: 0 };
var FFT_SIZE = 8192;
var HPS_HARMONICS = 5;
var MIN_F0_HZ = 20;
var SHORT_LOOP_SAMPLES = 512;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1)
      j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * wr - im[i + k + half] * wi;
        const vi = re[i + k + half] * wi + im[i + k + half] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
      }
    }
  }
}
function spectralF0(samples, offset = 0) {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const n = Math.min(samples.length - offset, FFT_SIZE);
  if (n < 64)
    return { hz: 0, confidence: 0 };
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
    re[i] = samples[offset + i] * w;
  }
  fft(re, im);
  const half = FFT_SIZE >> 1;
  const mag = new Float64Array(half);
  for (let i = 0; i < half; i++)
    mag[i] = Math.hypot(re[i], im[i]);
  const maxBin = Math.floor(half / HPS_HARMONICS);
  const minBin = Math.max(2, Math.ceil(MIN_F0_HZ * FFT_SIZE / DSP_SAMPLE_RATE));
  let bestBin = 0;
  let bestVal = 0;
  let total = 0;
  for (let b = minBin; b < maxBin; b++) {
    let p = 1;
    for (let h = 1; h <= HPS_HARMONICS; h++)
      p *= mag[b * h];
    total += p;
    if (p > bestVal) {
      bestVal = p;
      bestBin = b;
    }
  }
  if (bestBin <= 0 || total <= 0)
    return { hz: 0, confidence: 0 };
  const y0 = mag[bestBin - 1];
  const y1 = mag[bestBin];
  const y2 = mag[bestBin + 1];
  const denom = y0 - 2 * y1 + y2;
  const delta = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
  return {
    hz: (bestBin + Math.max(-1, Math.min(1, delta))) * DSP_SAMPLE_RATE / FFT_SIZE,
    confidence: bestVal / total
  };
}
function autocorrelation(samples, lag) {
  const n = samples.length - lag;
  if (n <= 0)
    return 0;
  let dot = 0;
  let e1 = 0;
  let e2 = 0;
  for (let i = 0; i < n; i++) {
    dot += samples[i] * samples[i + lag];
    e1 += samples[i] * samples[i];
    e2 += samples[i + lag] * samples[i + lag];
  }
  return dot / Math.sqrt(e1 * e2 || 1);
}
function decodeChain(ram, startAddr, maxBlocks) {
  const samples = [];
  const blocks = [];
  let addr = startAddr & 65535;
  for (let b = 0; b < maxBlocks; b++) {
    blocks.push(addr);
    const header = ram[addr];
    const shift = header >> 4;
    const filter = header >> 2 & 3;
    for (let k = 0; k < 8; k++) {
      const byte = ram[addr + 1 + k & 65535];
      for (let half = 0; half < 2; half++) {
        const nibble = half === 0 ? byte >> 4 : byte & 15;
        let s = nibble << 28 >> 28;
        s = shift <= 12 ? s << shift >> 1 : s >> 3 << 11;
        const p1 = samples.length >= 1 ? samples[samples.length - 1] : 0;
        const p2 = samples.length >= 2 ? samples[samples.length - 2] >> 1 : 0;
        switch (filter) {
          case 1:
            s += p1 >> 1;
            s += -p1 >> 5;
            break;
          case 2:
            s += p1;
            s += -(p1 + (p1 >> 1)) >> 5;
            s -= p2;
            s += p2 >> 4;
            break;
          case 3:
            s += p1;
            s += -(p1 + (p1 << 2) + (p1 << 3)) >> 7;
            s -= p2;
            s += p2 + (p2 << 1) >> 4;
            break;
        }
        const c = s < -32768 ? -32768 : s > 32767 ? 32767 : s;
        samples.push(c * 2 << 16 >> 16);
      }
    }
    addr = addr + 9 & 65535;
    if (header & 1)
      return { samples, blocks, loops: (header & 2) !== 0 };
  }
  return { samples, blocks, loops: false };
}
function analyzeSample(ram, dirPage, srcn) {
  const base = (dirPage << 8) + srcn * 4 & 65535;
  const start = ram[base] | ram[base + 1 & 65535] << 8;
  const loop = ram[base + 2 & 65535] | ram[base + 3 & 65535] << 8;
  const chain = decodeChain(ram, start, 4096);
  if (chain.samples.length === 0)
    return UNKNOWN;
  if (!chain.loops) {
    const skip = Math.min(Math.floor(chain.samples.length * 0.15), 320);
    const { hz: hz2, confidence: confidence2 } = spectralF0(chain.samples, skip);
    return { hz: hz2, confidence: confidence2, method: "one-shot", loopLength: 0 };
  }
  const loopIndex = chain.blocks.indexOf(loop & 65535);
  if (loopIndex < 0) {
    const { hz: hz2, confidence: confidence2 } = spectralF0(chain.samples);
    return { hz: hz2, confidence: confidence2, method: "spectrum", loopLength: 0 };
  }
  const loopLength = (chain.blocks.length - loopIndex) * 16;
  const body = chain.samples.slice(loopIndex * 16);
  const reps = Math.max(2, Math.ceil(FFT_SIZE * 2 / Math.max(1, loopLength)));
  const tiled = [];
  for (let r = 0; r < reps; r++)
    for (let i = 0; i < body.length; i++)
      tiled.push(body[i]);
  const region = tiled.slice(loopLength);
  if (loopLength <= SHORT_LOOP_SAMPLES) {
    for (let cycles = 1; cycles <= 8; cycles++) {
      if (loopLength % cycles !== 0)
        continue;
      const period = loopLength / cycles;
      if (period < 8)
        break;
      const r = autocorrelation(region, period);
      if (r > 0.9) {
        return {
          hz: DSP_SAMPLE_RATE / period,
          confidence: r,
          method: "loop",
          loopLength
        };
      }
    }
  }
  const { hz, confidence } = spectralF0(region);
  return { hz, confidence, method: "spectrum", loopLength };
}

// upstream/src/tuning.ts
var MIN_OBSERVATIONS = 8;
var MAX_OBSERVATIONS = 64;
var A4_HZ = 440;
var A4_MIDI = 69;
var PITCH_ONE2 = 4096;
var Tuning = class {
  constructor(ram, dirPage) {
    this.ram = ram;
    this.dirPage = dirPage;
    this.base = new Map();
    this.deviations = new Map();
    this.correction = new Map();
  }
  setDirectoryPage(page) {
    if (page === this.dirPage)
      return;
    this.dirPage = page;
    this.base.clear();
    this.deviations.clear();
    this.correction.clear();
  }
  baseOf(srcn) {
    let b = this.base.get(srcn);
    if (b == null) {
      b = analyzeSample(this.ram, this.dirPage, srcn);
      this.base.set(srcn, b);
    }
    return b;
  }
  noteOf(srcn, pitch) {
    if (pitch <= 0)
      return null;
    const b = this.baseOf(srcn);
    if (b.hz <= 0)
      return null;
    const hz = b.hz * (pitch / PITCH_ONE2);
    const midi = A4_MIDI + 12 * Math.log2(hz / A4_HZ);
    return midi - (this.correction.get(srcn) ?? 0);
  }
  observe(srcn, pitch) {
    if (pitch <= 0)
      return;
    const b = this.baseOf(srcn);
    if (b.hz <= 0)
      return;
    let list = this.deviations.get(srcn);
    if (list == null) {
      list = [];
      this.deviations.set(srcn, list);
    }
    if (list.length >= MAX_OBSERVATIONS)
      return;
    const hz = b.hz * (pitch / PITCH_ONE2);
    const midi = A4_MIDI + 12 * Math.log2(hz / A4_HZ);
    list.push(midi - Math.round(midi));
    if (list.length >= MIN_OBSERVATIONS) {
      const sorted = [...list].sort((x, y) => x - y);
      this.correction.set(srcn, sorted[sorted.length >> 1]);
    }
  }
  isRefined(srcn) {
    return this.correction.has(srcn);
  }
};

// upstream/src/player.ts
var DEFAULT_PLAY_SECONDS = 180;
var DEFAULT_FADE_SECONDS = 5;
var SPCPlayer = class {
  constructor(options = {}) {
    this.apu = new SPCAPU();
    this.file = null;
    this.outputSample = 0;
    this.dspSample = 0;
    this.frame = new Int32Array(2);
    this.source = (dst) => {
      this.apu.renderSample(dst);
      this.dspSample++;
      if (this.voiceCaptureEnabled)
        this.appendVoiceCapture();
    };
    this.voiceCaptureEnabled = false;
    this.voiceCaptureBuffer = new Int16Array(0);
    this.voiceCaptureCount = 0;
    this.tuning = null;
    this.sampleRate = options.sampleRate ?? DSP_SAMPLE_RATE;
    this.options = {
      sampleRate: this.sampleRate,
      resumeVoices: options.resumeVoices ?? false,
      retriggerKeyOn: options.retriggerKeyOn ?? true,
      clearEchoBuffer: options.clearEchoBuffer ?? true,
      loopCount: options.loopCount ?? 2,
      defaultPlaySeconds: options.defaultPlaySeconds ?? DEFAULT_PLAY_SECONDS,
      defaultFadeSeconds: options.defaultFadeSeconds ?? DEFAULT_FADE_SECONDS
    };
    this.resampler = this.sampleRate === DSP_SAMPLE_RATE ? null : new Resampler(DSP_SAMPLE_RATE, this.sampleRate);
  }
  get voiceCapture() {
    return this.voiceCaptureBuffer;
  }
  get voiceCaptureLength() {
    return this.voiceCaptureCount;
  }
  appendVoiceCapture() {
    const need = (this.voiceCaptureCount + 1) * 8;
    if (need > this.voiceCaptureBuffer.length) {
      const grown = new Int16Array(Math.max(need, this.voiceCaptureBuffer.length * 2, 4096));
      grown.set(this.voiceCaptureBuffer);
      this.voiceCaptureBuffer = grown;
    }
    this.voiceCaptureBuffer.set(this.apu.dsp.voiceOut, this.voiceCaptureCount * 8);
    this.voiceCaptureCount++;
  }
  drainNoteOns() {
    const events = this.apu.dsp.noteOnEvents;
    if (events.length === 0)
      return;
    const t = this.tuning;
    if (t != null) {
      for (let i = 0; i < events.length; i += 2)
        t.observe(events[i], events[i + 1]);
    }
    events.length = 0;
  }
  get tags() {
    return this.file?.tags ?? {};
  }
  get playSeconds() {
    const t = this.tags;
    if (t.introSeconds != null && t.loopSeconds != null) {
      const loops = t.loopCount ?? this.options.loopCount;
      return t.introSeconds + t.loopSeconds * loops + (t.endSeconds ?? 0);
    }
    return t.playSeconds ?? this.options.defaultPlaySeconds;
  }
  get fadeSeconds() {
    const ms = this.tags.fadeMilliseconds;
    return ms != null ? ms / 1e3 : this.options.defaultFadeSeconds;
  }
  get totalSeconds() {
    return this.playSeconds + this.fadeSeconds;
  }
  get currentTime() {
    return this.outputSample / this.sampleRate;
  }
  load(input) {
    const file = input instanceof Uint8Array || input instanceof ArrayBuffer ? parseSPC(input) : input;
    this.file = file;
    const apu = this.apu;
    apu.reset();
    apu.ram.set(file.ram);
    apu.iplRom.set(file.iplRom);
    apu.dsp.regs.set(file.dspRegs);
    apu.cpu.PC = file.registers.pc;
    apu.cpu.A = file.registers.a;
    apu.cpu.X = file.registers.x;
    apu.cpu.Y = file.registers.y;
    apu.cpu.SP = file.registers.sp;
    apu.cpu.PSW = file.registers.psw;
    apu.cpu.halted = false;
    apu.applyRegisterBlock();
    if (this.options.clearEchoBuffer)
      this.clearEchoRegion();
    this.tuning = new Tuning(apu.ram, apu.dsp.regs[93]);
    apu.dsp.noteOnEvents.length = 0;
    const candidates = apu.dsp.restoreFromSnapshot(this.options.resumeVoices);
    if (this.options.retriggerKeyOn && candidates !== 0) {
      apu.dsp.applyKeyOnRecovery(candidates);
    }
    this.outputSample = 0;
    this.dspSample = 0;
    this.resampler?.reset();
  }
  clearEchoRegion() {
    const dsp = this.apu.dsp;
    if (dsp.regs[108] & 32)
      return;
    const start = dsp.regs[109] << 8;
    const length = Math.max(4, (dsp.regs[125] & 15) * 2048);
    for (let i = 0; i < length; i++)
      this.apu.ram[start + i & 65535] = 0;
  }
  renderInto(left, right, offset, count) {
    const apu = this.apu;
    const frame = this.frame;
    this.voiceCaptureCount = 0;
    if (this.resampler == null) {
      for (let i = 0; i < count; i++) {
        apu.renderSample(frame);
        if (this.voiceCaptureEnabled)
          this.appendVoiceCapture();
        left[offset + i] = frame[0];
        right[offset + i] = frame[1];
      }
      this.dspSample += count;
    } else {
      this.resampler.process(left, right, offset, count, this.source);
    }
    this.drainNoteOns();
    this.applyFade(left, right, offset, count);
    this.outputSample += count;
    return count;
  }
  render(count) {
    const left = new Int16Array(count);
    const right = new Int16Array(count);
    this.renderInto(left, right, 0, count);
    return { left, right };
  }
  skip(count) {
    const apu = this.apu;
    const frame = this.frame;
    if (this.resampler == null) {
      for (let i = 0; i < count; i++)
        apu.renderSample(frame);
      this.dspSample += count;
    } else {
      this.resampler.skip(count, this.source);
    }
    this.drainNoteOns();
    this.outputSample += count;
  }
  applyFade(left, right, offset, count) {
    const fade = this.fadeSeconds;
    if (fade <= 0)
      return;
    const fadeStart = this.playSeconds * this.sampleRate;
    const fadeLength = fade * this.sampleRate;
    const end = this.outputSample + count;
    if (end <= fadeStart)
      return;
    for (let i = 0; i < count; i++) {
      const pos = this.outputSample + i - fadeStart;
      if (pos < 0)
        continue;
      const gain = pos >= fadeLength ? 0 : 1 - pos / fadeLength;
      left[offset + i] = left[offset + i] * gain | 0;
      right[offset + i] = right[offset + i] * gain | 0;
    }
  }
  saveState() {
    return {
      apu: this.apu.saveState(),
      outputSample: this.outputSample,
      dspSample: this.dspSample,
      resampler: this.resampler?.saveState() ?? null
    };
  }
  restoreState(state) {
    this.apu.loadState(state.apu);
    this.outputSample = state.outputSample;
    this.dspSample = state.dspSample;
    if (this.resampler != null) {
      if (state.resampler != null)
        this.resampler.loadState(state.resampler);
      else
        this.resampler.reset();
    }
  }
  setVoiceMask(mask) {
    this.apu.dsp.voiceMask = mask & 255;
  }
  getVoiceMask() {
    return this.apu.dsp.voiceMask;
  }
  getVoiceStatus(index) {
    const dsp = this.apu.dsp;
    const v = dsp.voices[index];
    const base = index << 4;
    const bit = 1 << index;
    const source = dsp.regs[base + 4];
    const pitch = dsp.pitchOf(index);
    const active = dsp.isActive(index);
    return {
      index,
      active,
      envelope: v.envelope,
      volumeLeft: dsp.regs[base + 0] << 24 >> 24,
      volumeRight: dsp.regs[base + 1] << 24 >> 24,
      pitch,
      note: active && pitch > 0 ? this.tuning?.noteOf(source, pitch) ?? null : null,
      semitone: active && pitch > 0 ? 12 * Math.log2(pitch / 4096) : null,
      tuningConfidence: this.tuning?.baseOf(source).confidence ?? 0,
      source,
      noise: (dsp.regs[61] & bit) !== 0,
      echo: (dsp.regs[77] & bit) !== 0,
      pitchModulated: (dsp.regs[45] & bit) !== 0,
      envelopeMode: v.envelopeMode,
      keyOnAt: v.keyOnAt,
      keyOnCount: v.keyOnCount
    };
  }
  getVoiceStatusArray() {
    const out = [];
    for (let i = 0; i < 8; i++)
      out.push(this.getVoiceStatus(i));
    return out;
  }
  get dspSampleCount() {
    return this.dspSample;
  }
};
export {
  CPU_CLOCK,
  CYCLES_PER_SAMPLE,
  DSP,
  DSP_SAMPLE_RATE,
  EnvMode,
  GAUSS_TABLE,
  Resampler,
  SPC700,
  SPCAPU,
  SPCPlayer,
  Tuning,
  Voice,
  analyzeSample,
  isSPCFile,
  parseSPC,
  setGaussianTable
};
