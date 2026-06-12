import { Navigate } from "react-router-dom";
import { useAuth, canAccess } from "../lib/auth";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthed, isLoading, role } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading SpotyTags…</p>
        </div>
      </div>
    );
  }
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (allowedRoles && !canAccess(role, allowedRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-md">
          <h2 className="font-heading text-3xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Your role ({role}) doesn't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return children;
}
