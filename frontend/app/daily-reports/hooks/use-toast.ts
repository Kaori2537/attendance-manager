"use client";

import * as React from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

type Toast = ToastProps & { id: string };

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 3000;

type Action =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

interface State {
  toasts: Toast[];
}

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST": {
      const toasts = [action.toast, ...state.toasts].slice(0, TOAST_LIMIT);
      return { ...state, toasts };
    }
    case "DISMISS_TOAST": {
      const { toastId } = action;
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          !toastId || t.id === toastId ? { ...t } : t
        ),
      };
    }
    case "REMOVE_TOAST": {
      const { toastId } = action;
      if (!toastId) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== toastId) };
    }
    default:
      return state;
  }
}

function genId() {
  return Math.random().toString(36).slice(2);
}

export function toast(props: ToastProps) {
  const id = genId();

  dispatch({
    type: "ADD_TOAST",
    toast: { id, ...props },
  });

  window.setTimeout(() => {
    dispatch({ type: "REMOVE_TOAST", toastId: id });
  }, TOAST_REMOVE_DELAY);

  return { id };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}
