'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Stage = 'builder' | 'report';

/** The report is a query state on the calculator route, not a separate page. */
export const STAGE_PARAM = 'stage';
export const REPORT_STAGE = 'report';

function readStageFromLocation(): Stage {
  if (typeof window === 'undefined') {
    return 'builder';
  }
  const stage = new URLSearchParams(window.location.search).get(STAGE_PARAM);
  return stage === REPORT_STAGE ? 'report' : 'builder';
}

/** Rebuilds the current URL for a stage, leaving any unrelated query intact. */
function urlForStage(stage: Stage): string {
  const params = new URLSearchParams(window.location.search);
  if (stage === 'report') {
    params.set(STAGE_PARAM, REPORT_STAGE);
  } else {
    params.delete(STAGE_PARAM);
  }
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
}

export interface UseStageHistoryOptions {
  /** False until the persisted session has been read, so reload can be judged. */
  ready: boolean;
  /** Whether a report is meaningful — an empty meal has nothing to report on. */
  canShowReport: boolean;
}

export interface UseStageHistoryResult {
  stage: Stage;
  showReport: () => void;
  showBuilder: () => void;
}

/**
 * Mirrors the builder/report stage into the browser history so Back and Forward
 * behave the way the URL implies, without turning the report into a route that
 * would tear down the session.
 *
 * React state stays the render source and history is the mirror; `popstate` is
 * what reconciles the two. Only reaching the report pushes an entry, so editing
 * a meal never fills the history stack.
 */
export function useStageHistory({
  ready,
  canShowReport,
}: UseStageHistoryOptions): UseStageHistoryResult {
  const [stage, setStage] = useState<Stage>('builder');
  const [reconciled, setReconciled] = useState(false);

  /**
   * Whether this app instance pushed the report entry itself. After a reload
   * directly onto `?stage=report` it is false, which is what stops the in-app
   * Back control from walking the user off the site.
   */
  const pushedReport = useRef(false);

  // A reload on the report URL should land back on the report — but only once
  // the stored meal is known, and only if that meal still has something in it.
  // Resolved during render rather than in an effect so the report is the first
  // thing painted, with no builder flash in between.
  if (ready && !reconciled) {
    setReconciled(true);
    if (readStageFromLocation() === 'report' && canShowReport) {
      setStage('report');
    }
  }

  // The URL is an external system, so correcting it belongs in an effect. This
  // is what strips `?stage=report` from a link whose meal no longer exists.
  useEffect(() => {
    if (ready && stage === 'builder' && readStageFromLocation() === 'report') {
      window.history.replaceState(null, '', urlForStage('builder'));
    }
  }, [ready, stage]);

  useEffect(() => {
    function handlePopState() {
      const next = readStageFromLocation();
      // Arriving at the report through Forward means the builder entry is still
      // behind us, so the in-app control can keep using history.back().
      pushedReport.current = next === 'report';
      setStage(next);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showReport = useCallback(() => {
    if (readStageFromLocation() !== 'report') {
      window.history.pushState(null, '', urlForStage('report'));
      pushedReport.current = true;
    }
    setStage('report');
  }, []);

  const showBuilder = useCallback(() => {
    if (pushedReport.current) {
      // Going back rather than pushing keeps Forward pointing at the report,
      // and lets the popstate handler perform the single state update.
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', urlForStage('builder'));
    setStage('builder');
  }, []);

  return { stage, showReport, showBuilder };
}
