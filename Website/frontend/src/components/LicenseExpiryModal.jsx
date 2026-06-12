import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useLicense } from "../lib/license";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { AlertTriangle, Mail, RefreshCw } from "lucide-react";

const STATUS_LABELS = {
  expired: "Plan Expired",
  suspended: "Plan Suspended",
  cancelled: "Plan Cancelled",
};

const STATUS_MESSAGES = {
  expired: "Your plan has expired. All features are blocked until you renew.",
  suspended: "Your plan has been suspended. Please contact support to restore access.",
  cancelled: "Your plan has been cancelled. Please contact support to reactivate.",
};

export default function LicenseExpiryModal() {
  const [showModal, setShowModal] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { blocked, block_reason, loading } = useLicense();

  // Triggered by API interceptor (403 on any request)
  useEffect(() => {
    const handleLicenseExpired = (event) => {
      const errorData = event.detail;
      setLicenseStatus(errorData.license_status || "expired");
      setShowModal(true);
    };

    window.addEventListener("license-expired", handleLicenseExpired);

    if (window.__licenseError) {
      handleLicenseExpired({ detail: window.__licenseError });
    }

    return () => {
      window.removeEventListener("license-expired", handleLicenseExpired);
    };
  }, []);

  // Triggered by LicenseProvider polling (/license/validate every 60s)
  useEffect(() => {
    if (!loading && blocked && block_reason) {
      setLicenseStatus(block_reason);
      setShowModal(true);
    }
  }, [blocked, block_reason, loading]);

  const status = licenseStatus || "expired";
  const title = STATUS_LABELS[status] || `License ${status}`;
  const message = STATUS_MESSAGES[status] || `Your license is ${status}. Please contact support to renew your subscription.`;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md bg-cream text-ink-900 border border-hairline-soft shadow-apple-lg rounded-2xl"
        hideCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-oxblood/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-oxblood" />
            </div>
            <DialogTitle className="font-display text-2xl tracking-tighter-apple text-oxblood">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-ink-600 text-sm mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-oxblood/5 border border-oxblood/20 rounded-xl p-4 mt-4 space-y-3">
          <p className="text-sm text-ink-700">
            Your data remains safe and will be accessible after renewal.
            To renew or restore your plan, contact us:
          </p>
          <a
            href="mailto:help@spotytags.com"
            className="flex items-center gap-2 text-sm font-semibold text-ink-900 hover:underline"
          >
            <Mail className="w-4 h-4 text-oxblood" />
            help@spotytags.com
          </a>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            onClick={() => logout().then(() => navigate("/login"))}
            className="text-xs text-ink-500 hover:text-ink-800 transition-colors"
          >
            Sign out
          </button>
          <a
            href="mailto:help@spotytags.com"
            className="btn-apple btn-apple-primary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Renew Plan
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
