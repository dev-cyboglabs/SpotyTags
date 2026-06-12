import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Surface, SectionHeader } from "../components/Editorial";
import { QrCode, Download, Smartphone, ArrowLeft, RefreshCw, Settings } from "lucide-react";

export default function MobileAppDownload() {
  const [customIp, setCustomIp] = useState("");
  
  const apkUrl = useMemo(() => {
    const host = customIp || window.location.hostname;
    return `http://${host}:8001/download/apk`;
  }, [customIp]);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(apkUrl)}`;

  return (
    <div className="max-w-7xl p-4 lg:p-8 space-y-8">
      <SectionHeader
        overline="Staff Mobile App"
        title={
          <>
            <span>Download the</span>
            <span className="accent-serif text-brand block mt-1">companion app.</span>
          </>
        }
        lead="Scan the QR code below with any Android device on the same network to download and install the SpotyTags staff app."
        right={
          <Link to="/mobile-app-info" className="btn-apple btn-apple-secondary text-xs flex items-center gap-1.5">
            App Info
          </Link>
        }
      />

      {/* QR + instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* QR card */}
        <Surface padding="p-6 lg:p-8" className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2 self-start">
            <QrCode className="w-4 h-4 text-brand" />
            <span className="smallcaps text-ink-600">Scan to download</span>
          </div>
          <div className="rounded-2xl border border-hairline-soft bg-white p-3 shadow-sm">
            <img
              src={qrSrc}
              alt="QR code to download APK"
              width={240}
              height={240}
              className="block rounded-xl"
            />
          </div>
          <a
            href={apkUrl}
            download="SpotyTags.apk"
            className="btn-apple btn-apple-primary text-xs flex items-center gap-1.5 w-[265px] justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            Download directly
          </a>
          
          {/* IP Input */}
          <div className="w-full space-y-3 pt-4 border-t border-hairline-soft">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand" />
              <span className="smallcaps text-ink-600">Server IP Address</span>
            </div>
            <p className="text-xs text-ink-600">
              If your mobile device cannot connect, enter the local IP address of this server (e.g., 192.168.1.100):
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customIp}
                onChange={(e) => setCustomIp(e.target.value)}
                placeholder="192.168.1.XX"
                className="flex-1 bg-white border border-hairline-soft rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-brand transition-colors"
              />
              <button
                onClick={() => setCustomIp("")}
                className="btn-apple btn-apple-secondary text-xs px-3"
              >
                Reset
              </button>
            </div>
          </div>
        </Surface>

        {/* Steps */}
        <Surface padding="p-6 lg:p-8" className="space-y-6">
  <div className="flex items-center gap-2">
    <Smartphone className="w-4 h-4 text-brand" />
    <span className="smallcaps text-ink-600">Installation steps</span>
  </div>

  <ol className="space-y-6">
    {[
      {
        step: "1",
        title: "Connect to Wi-Fi",
        body: "Ensure your Android device is connected to the same local network as this server.",
      },
      {
        step: "2",
        title: "Scan the QR code",
        body: "Use your camera or any QR scanner to open the download page.",
      },
      {
        step: "3",
        title: "Install the app",
        body: 'If Android shows a warning, tap "Install anyway" or allow installs from your browser.',
      },
      {
        step: "4",
        title: "Configure SpotyTags",
        body: (
          <div className="space-y-2">
            <p>
              Open SpotyTags, tap{" "}
              <Settings className="inline w-3 h-3 mx-0.5" />
              <span className="font-medium"> Settings</span>, then enter:
            </p>

            <code className="inline-flex rounded-lg border border-brand/20 bg-cream-deep px-2.5 py-1.5 font-mono text-[11px] text-brand">
              http://your-server-ip:8001
            </code> <p>Tap Save & Continue.</p>
          </div>
        ),
      },
      {
        step: "5",
        title: "Sign in",
        body: "Log in with your email address and password.",
      },
    ].map(({ step, title, body }) => (
      <li key={step} className="flex gap-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
          {step}
        </span>

        <div>
          <p className="text-sm font-semibold text-ink-900 tracking-tighter-apple">
            {title}
          </p>

          <div className="mt-1 text-xs leading-relaxed text-ink-600">
            {body}
          </div>
        </div>
      </li>
    ))}
  </ol>
</Surface>
      </div>
    </div>
  );
}
