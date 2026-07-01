// Minimal type shims for FiftyOne packages that are provided at runtime by
// the FiftyOne App. We declare only the surface we use; extend as needed.

declare module "@fiftyone/plugins" {
  export enum PluginComponentType {
    Component = "Component",
    Panel = "Panel",
  }
  export interface PanelOptions {
    surfaces?: string;
    [key: string]: any;
  }
  export interface RegisterComponentParams {
    name: string;
    label: string;
    component: any;
    type: PluginComponentType;
    panelOptions?: PanelOptions;
    activator?: (ctx?: any) => boolean;
  }
  export function registerComponent(params: RegisterComponentParams): void;
}

declare module "@fiftyone/spaces" {
  export function usePanelStatePartial<T>(
    key: string,
    defaultState?: T,
    local?: boolean,
    scope?: string,
  ): [T, (v: T) => void];
  export function usePanelId(): string;
}

declare module "@fiftyone/playback" {
  export interface TimelineSubscription {
    id: string;
    loadRange: (range: [number, number]) => Promise<void>;
    renderFrame: (frameNumber: number) => void;
  }
  export interface TimelineHookResult {
    subscribe: (subscription: TimelineSubscription) => void;
    isTimelineInitialized: boolean;
  }
  export interface DispatchTimelineSetFrameNumberEventParams {
    timelineName: string;
    newFrameNumber: number;
  }
  export function useTimeline(timelineName: string): TimelineHookResult;
  export function useDefaultTimelineNameImperative(): {
    getName: () => string;
  };
  export function dispatchTimelineSetFrameNumberEvent(
    params: DispatchTimelineSetFrameNumberEventParams,
  ): void;
  export function useFrameNumber(name?: string): number;
}

declare module "@fiftyone/operators" {
  export function useOperatorExecutor(uri: string): {
    execute: (
      params?: Record<string, any>,
      options?: {
        callback?: (
          raw: { result: any; error: any },
          opts: { ctx?: any },
        ) => void;
      },
    ) => void;
    result: any;
    isExecuting?: boolean;
    error?: any;
    hasExecuted?: boolean;
  };
}

declare module "@fiftyone/state" {
  export const modalSample: any;
  // Recoil atom resolving to the open modal sample's id, or null when no
  // modal is open. Safe to read with no modal (unlike modalSample, which
  // dereferences a null modal context and throws).
  export const nullableModalSampleId: any;
  export const view: any;
  export const extendedSelection: any;
  export const selectedSamples: any;
}

// react-plotly.js ships no bundled types; we only use the factory entry to
// bind the cartesian-dist Plotly build.
declare module "react-plotly.js/factory" {
  const createPlotlyComponent: (plotly: any) => any;
  export default createPlotlyComponent;
}

declare module "plotly.js-cartesian-dist-min" {
  const Plotly: any;
  export default Plotly;
}

declare module "recoil" {
  export function useRecoilValue<T>(atom: any): T;
  export function useSetRecoilState<T>(
    atom: any,
  ): (v: T | ((prev: T) => T)) => void;
}
