import { useCallback } from "react";
import {
  dispatchTimelineSetFrameNumberEvent,
  useDefaultTimelineNameImperative,
  useFrameNumber,
} from "@fiftyone/playback";

/**
 * Bidirectional sync with the active video timeline.
 *
 * - Reads: `useFrameNumber` returns the timeline's current frame (a jotai atom
 *   value), so the panel re-renders when the user plays/scrubs the video. This
 *   is the read-only frame hook FiftyOne recommends; it manages its own
 *   subscription lifecycle, avoiding the "replacing subscription" churn a raw
 *   useTimeline().subscribe() incurs when the timeline name changes (e.g. when
 *   switching modal samples). Returns -1 when no timeline is initialized.
 * - Writes: `seekFrame` drives the video element via
 *   dispatchTimelineSetFrameNumberEvent (the looker listens for that DOM event;
 *   the atom catches up via the looker's own callback once it has seeked).
 *
 * currentFrame is null when there is no active/initialized timeline (e.g. grid
 * mode without a modal video).
 */
export function useFrameSync() {
  const { getName } = useDefaultTimelineNameImperative();
  const timelineName = getName();

  const frame = useFrameNumber(timelineName);
  const currentFrame = frame >= 0 ? frame : null;

  const seekFrame = useCallback(
    (frameNumber: number) => {
      if (!timelineName) return;
      dispatchTimelineSetFrameNumberEvent({
        timelineName,
        newFrameNumber: frameNumber,
      });
    },
    [timelineName],
  );

  return { currentFrame, seekFrame };
}
