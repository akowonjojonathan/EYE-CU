import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  errorMessage: string | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      errorMessage:
        error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  override render() {
    if (this.state.errorMessage) {
      let displayMsg = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error) {
          displayMsg = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ""}`;
        }
      } catch {
        // Keep plain message
      }

      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: "var(--bg)",
            color: "var(--fg)",
          }}
        >
          <div
            style={{
              maxWidth: 460,
              padding: 24,
              borderRadius: 18,
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>EYE-CU Notice</h1>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted-fg)" }}>
              {displayMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="primary-cta"
            >
              Reload EYE-CU
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
