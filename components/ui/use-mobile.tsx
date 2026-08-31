import * as React from 'react'

const MOBILE_BREAKPOINT = 768

// `useSyncExternalStore` e o hook feito para assinar um sistema externo
// mutavel (aqui, `window.matchMedia`) sem o padrao efeito+setState sincrono
// (sinalizado pelo lint de pureza do React Compiler como causa de re-render
// em cascata) — e ja hydration-safe via `getServerSnapshot`.
function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
