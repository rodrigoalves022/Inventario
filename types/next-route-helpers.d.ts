import type * as React from 'react'

type SegmentParam<S extends string> =
  S extends `[[...${infer Param}]]`
    ? { [K in Param]?: string[] }
    : S extends `[...${infer Param}]`
      ? { [K in Param]: string[] }
      : S extends `[${infer Param}]`
        ? { [K in Param]: string }
        : {}

type ExtractRouteParamsInternal<Path extends string> =
  Path extends `${infer Head}/${infer Tail}`
    ? SegmentParam<Head> & ExtractRouteParamsInternal<Tail>
    : SegmentParam<Path>

type ExtractRouteParams<Path extends string> =
  Path extends `/${infer Rest}`
    ? ExtractRouteParamsInternal<Rest>
    : ExtractRouteParamsInternal<Path>

declare global {
  type PageProps<Route extends string = string> = {
    params: Promise<ExtractRouteParams<Route>>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
  }

  type LayoutProps<Route extends string = string> = {
    children: React.ReactNode
    params: Promise<ExtractRouteParams<Route>>
  }

  type RouteContext<Route extends string = string> = {
    params: Promise<ExtractRouteParams<Route>>
  }
}

export {}

