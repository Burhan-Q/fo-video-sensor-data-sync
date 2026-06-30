// Shim for the automatic JSX runtime. VOODO is compiled with `jsx-runtime`
// imports; the FiftyOne App's classic React UMD only exposes `createElement`
// (not `jsx`/`jsxs`). We translate jsx-runtime calls into proper
// `createElement` invocations: extract `children` from props so they don't
// get smashed by the trailing `key` argument, and forward `key` correctly.
import * as React from "react";

const R: any = React;
const native = R.jsx;
const nativeS = R.jsxs;
const nativeDEV = R.jsxDEV;

export const Fragment = R.Fragment;

function shim(type: any, props: any, key?: any) {
  const { children, ...rest } = props ?? {};
  if (key !== undefined) (rest as any).key = key;
  if (children === undefined) return R.createElement(type, rest);
  if (Array.isArray(children)) return R.createElement(type, rest, ...children);
  return R.createElement(type, rest, children);
}

export const jsx = native ?? shim;
export const jsxs = nativeS ?? shim;
export const jsxDEV = nativeDEV ?? shim;
