"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

type DrawerState = {
  open: boolean;
  title: string;
  renderContent: (() => ReactNode) | null;
  openDrawer: (opts: { title: string; renderContent: () => ReactNode }) => void;
  closeDrawer: () => void;
};

export const useCopilotDrawer = create<DrawerState>((set) => ({
  open: false,
  title: "",
  renderContent: null,
  openDrawer: ({ title, renderContent }) =>
    set({ open: true, title, renderContent }),
  closeDrawer: () => set({ open: false, renderContent: null }),
}));
