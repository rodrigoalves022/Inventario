// Payloads da Sprint A1a (achado N1), compartilhados entre
// tests/provisioning-security.test.ts e os testes da Sprint A4 (bash/Linux).
// Nao e arquivo de teste (nao casa com tests/**/*.test.*): so dados.

export const REAL_SLUG = 'core-ti-expert'
export const REAL_KEY = 'a3f1c9e07b5d42e8961f0c7a2b4d6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9'
export const SERVER_URL = 'https://inventario.example.com'
// Hash SHA-256 valido (64 hex minusculos) usado onde o builder exige um.
export const VALID_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

// Fragmentos injetados no MEIO do valor (o schema faz .trim(), entao
// injecao so nas pontas poderia ser removida pelo trim e mascarar o teste).
export const MALICIOUS_FRAGMENTS: Array<[string, string]> = [
  ['quebra de linha \\n', '\ncalc.exe\n'],
  ['quebra de linha \\r\\n', '\r\ncalc.exe\r\n'],
  ["aspa simples ASCII '", "';calc.exe;'"],
  ['aspa U+2018', '\u2018;calc.exe;\u2018'],
  ['aspa U+2019', '\u2019;calc.exe;\u2019'],
  ['aspa U+201A', '\u201A;calc.exe;\u201A'],
  ['aspa U+201B', '\u201B;calc.exe;\u201B'],
  ['aspa dupla "', '" & calc.exe & "'],
  ['backtick', '`ncalc.exe'],
  ['subexpressao $(...)', '$(calc.exe)'],
  ['ponto e virgula ;', ';calc.exe'],
  ['pipe |', '|calc.exe'],
  ['e comercial &', '&calc.exe'],
  ['NUL', '\u0000calc.exe'],
  ['controle BEL', '\u0007'],
  ['controle ESC', '\u001b[0m'],
  ['controle DEL', '\u007f'],
  ['tabulacao', '\tcalc.exe'],
  ['calc.exe injetado', "'; Start-Process calc.exe; '"],
]

export const maliciousClient = (fragment: string) => `core${fragment}ti`
export const maliciousKey = (fragment: string) => `${REAL_KEY.slice(0, 32)}${fragment}${REAL_KEY.slice(32)}`

export const MALICIOUS_SERVER_URLS: Array<[string, string]> = [
  ['nao parseavel', 'nao e uma url'],
  ['vazio', ''],
  ['protocolo ftp', 'ftp://inventario.example.com'],
  ['protocolo javascript', 'javascript://inventario.example.com'],
  ['protocolo file', 'file:///C:/Windows/System32'],
  ["aspa simples ASCII '", "https://inventario.example.com/';calc.exe;'"],
  ['aspa U+2018', 'https://inventario.example.com/\u2018;calc.exe;\u2018'],
  ['aspa U+2019', 'https://inventario.example.com/\u2019;calc.exe;\u2019'],
  ['aspa U+201A', 'https://inventario.example.com/\u201A;calc.exe;\u201A'],
  ['aspa U+201B', 'https://inventario.example.com/\u201B;calc.exe;\u201B'],
  ['aspa dupla "', 'https://inventario.example.com/"&calc.exe&"'],
  ['backtick', 'https://inventario.example.com/`ncalc.exe'],
  ['cifrao $', 'https://inventario.example.com/$(calc.exe)'],
  ['\\r', 'https://inventario.example.com/\rcalc.exe'],
  ['\\n', 'https://inventario.example.com/\ncalc.exe'],
  ['NUL', 'https://inventario.example.com/\u0000calc.exe'],
  ['controle BEL', 'https://inventario.example.com/\u0007'],
]

export const LEGIT_SERVER_URLS = [
  'http://localhost:3000',
  'https://inventario.example.com',
  'http://192.168.0.10:3000/',
  'https://inventario.example.com/base/path',
]
