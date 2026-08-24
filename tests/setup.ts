import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Desmonta o DOM entre testes de componente (evita que "PC-CRITICO" de um
// teste ainda esteja montado quando o proximo teste consulta por texto).
// Inofensivo nos testes que nao usam @testing-library/react.
afterEach(() => {
  cleanup()
})
