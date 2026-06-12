import { Link } from "react-router-dom";
import { Surface, SectionHeader } from "../components/Editorial";
import {
  QrCode,
  ClipboardList,
  Wrench,
  CheckCircle2,
  Download,
  Info,
  RefreshCw,
  Activity,
} from "lucide-react";

export default function MobileAppInfo() {
  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-8" data-testid="mobile-app-info-page">
      <SectionHeader
        overline="SpotyTags Companion App"
        title={
          <>
            <span>Staff Mobile App</span>
            <span className="accent-serif text-brand block mt-1">on-the-go.</span>
          </>
        }
        lead="The real-time, offline-first companion application designed specifically for housekeeping and engineering teams working on the property floor."
        right={
          <Link
            to="/mobile-app-download"
            className="btn-apple btn-apple-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download App</span>
          </Link>
        }
      />

      {/* Grid: Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Surface padding="p-6 lg:p-8" className="flex flex-col h-full justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold tracking-tighter-apple text-ink-900">For Housekeeping</h2>
            <p className="text-ink-600 text-sm leading-relaxed">
              Empower room attendants to restock minibars, scan room tags, track items consumed, and report maintenance issues in seconds. Fully paperless and integrated.
            </p>
            <ul className="space-y-2.5 pt-2">
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">Real-time Task Queue</strong>: View rooms assigned for preparation or restock instantly.</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">QR Scanning</strong>: Scan a physical tag to load that room's inventory immediately.</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">Billing Integration</strong>: Submitting consumed items creates a billing card instantly.</span>
              </li>
            </ul>
          </div>
        </Surface>

        <Surface padding="p-6 lg:p-8" className="flex flex-col h-full justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <Wrench className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-semibold tracking-tighter-apple text-ink-900">For Technicians & Setup</h2>
            <p className="text-ink-600 text-sm leading-relaxed">
              Equip your hardware and maintenance engineers with offline diagnostics to setup gateway networks and pair active BLE tags effortlessly.
            </p>
            <ul className="space-y-2.5 pt-2">
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">Offline Setup & Sync</strong>: Sync local properties data, work completely offline, and upload back when online.</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">Gateway Diagnostics</strong>: Diagnose gateway connectivity issues in real-time over BLE.</span>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-ink-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong className="font-bold text-ink-900">Hardware Provisioning</strong>: Pair, activate, and replace sensor tags in seconds via physical scans.</span>
              </li>
            </ul>
          </div>
        </Surface>
      </div>

      {/* Feature Walkthrough */}
      <Surface padding="p-6 lg:p-8">
        <h3 className="smallcaps mb-6 text-ink-500">Core Native Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 tracking-tight">
              <QrCode className="w-4 h-4 text-brand" />
              <span>QR Quick Actions</span>
            </div>
            <p className="text-xs text-ink-600 leading-relaxed">
              Attendants tap their device on a door tag or scan the room's QR code to pull up live minibar contents. No searching or typing needed.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 tracking-tight">
              <RefreshCw className="w-4 h-4 text-brand" />
              <span>Offline Database Sync</span>
            </div>
            <p className="text-xs text-ink-600 leading-relaxed">
              Attendants can work seamlessly inside basements, concrete stairwells, or weak-signal elevators. Data is stored safely on-device and auto-syncs.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900 tracking-tight">
              <Activity className="w-4 h-4 text-brand" />
              <span>Live Discrepancy Reporting</span>
            </div>
            <p className="text-xs text-ink-600 leading-relaxed">
              Quickly raise discrepancy reports or room issues right from the task interface. Front desk sees the alerts instantly on their dashboard.
            </p>
          </div>
        </div>
      </Surface>

      {/* Info Card */}
      <div className="flex items-center gap-3 p-4 bg-ink-900/5 rounded-2xl border border-hairline-soft">
        <Info className="w-5 h-5 text-ink-500 shrink-0" />
        <p className="text-xs text-ink-700 leading-relaxed">
          The Mobile App is compiled natively for iOS and Android. It interacts directly with the local SpotyTags server API using local network communication.
        </p>
      </div>
    </div>
  );
}
