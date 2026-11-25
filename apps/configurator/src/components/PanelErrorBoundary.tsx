"use client";

import React from "react";

export interface PanelErrorBoundaryProps {
  panelName?: string;
  children: React.ReactNode;
  onReset?: () => void;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): PanelErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Beklenmeyen bir panel hatası oluştu.";
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error(
      `[PanelErrorBoundary:${this.props.panelName ?? "Panel"}] Render error:`,
      error,
      info.componentStack
    );
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-6 bg-[#FAF8F4] text-[#141413] border border-[#E5DFD3] rounded-2xl text-center gap-3"
        >
          <div className="text-sm font-bold">
            {this.props.panelName ?? "Görünüm Paneli"} geçici bir hatayla karşılaştı
          </div>
          <p className="text-xs text-[#57534E] max-w-md break-words">
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-[#292524] transition cursor-pointer"
          >
            Paneli Yeniden Yükle
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
