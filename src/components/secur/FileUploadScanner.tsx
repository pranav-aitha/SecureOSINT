import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { formatBytes } from "@/lib/detect";
import { cn } from "@/lib/utils";
import { vtLookup, vtUploadAndScan } from "@/lib/vt.functions";

interface FileUploadScannerProps {
  onScanStart?: (hash: string, fileName: string) => void;
}

export function FileUploadScanner({ onScanStart }: FileUploadScannerProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [knownReport, setKnownReport] = useState<boolean | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Convert arrayBuffer to base64
  const bufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const processFile = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setIsComputing(true);
      setIsUploading(false);
      setUploadError(null);
      setKnownReport(null);
      setProgress(5);
      setStatusText("Reading file byte stream...");
      setComputedHash(null);
      setFileBase64(null);

      try {
        // Read file
        const reader = new FileReader();
        const readPromise = new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 35);
              setProgress(Math.max(5, pct));
            }
          };
        });

        reader.readAsArrayBuffer(file);
        const buffer = await readPromise;

        // Encode base64 for potential upload
        const b64 = bufferToBase64(buffer);
        setFileBase64(b64);

        setProgress(45);
        setStatusText("Computing SHA-256 cryptographic digest in browser...");

        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        setProgress(75);
        setStatusText("Querying VirusTotal intelligence database for existing records...");

        setComputedHash(hashHex);

        // Check if hash already exists in VirusTotal
        try {
          const checkRes = await vtLookup({ data: { type: "file", id: hashHex } });
          if (checkRes.ok && !checkRes.notFound) {
            setKnownReport(true);
            setProgress(100);
            setStatusText("File found in VirusTotal threat grid! Full analysis report ready.");
          } else {
            setKnownReport(false);
            setProgress(100);
            setStatusText("Cryptographic checksum ready. File not yet cataloged in VirusTotal.");
          }
        } catch {
          setKnownReport(false);
          setProgress(100);
          setStatusText("Checksum ready. You can submit this file for full multi-engine analysis.");
        }

        setIsComputing(false);
      } catch (err) {
        console.error("Hash calculation failed:", err);
        setUploadError("Failed to process file. Please try another file.");
        setStatusText("Error during file verification.");
        setIsComputing(false);
      }
    },
    [],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0]) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0]) {
      processFile(files[0]);
    }
  };

  const handleCopyHash = () => {
    if (!computedHash) return;
    navigator.clipboard?.writeText(computedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Navigate to existing report
  const handleOpenExistingReport = () => {
    if (!computedHash || !selectedFile) return;
    if (onScanStart) {
      onScanStart(computedHash, selectedFile.name);
    }
    navigate({
      to: "/report/$type/$id",
      params: { type: "file", id: computedHash },
    });
  };

  // Upload file to VirusTotal
  const handleUploadAndScan = async () => {
    if (!fileBase64 || !selectedFile || !computedHash) return;

    setIsUploading(true);
    setUploadError(null);
    setStatusText("Uploading file to VirusTotal analysis cluster...");
    setProgress(30);

    try {
      const uploadTimer = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 12 : prev));
      }, 350);

      const res = await vtUploadAndScan({
        data: {
          fileBase64,
          fileName: selectedFile.name,
        },
      });

      clearInterval(uploadTimer);

      if (res.ok) {
        setProgress(75);
        setStatusText("Upload accepted by VirusTotal. Awaiting engine sandbox queue...");

        const targetSha = res.sha256 || computedHash;

        // Poll VirusTotal until report is populated
        let ready = false;
        for (let attempt = 1; attempt <= 6; attempt++) {
          await new Promise((r) => setTimeout(r, 2500));
          setProgress(Math.min(96, 75 + attempt * 4));
          setStatusText(`Analyzing across 70+ antivirus engines... (Attempt ${attempt}/6)`);

          try {
            const check = await vtLookup({ data: { type: "file", id: targetSha } });
            if (check.ok && !check.notFound) {
              ready = true;
              break;
            }
          } catch {
            /* continue polling */
          }
        }

        setProgress(100);
        setStatusText("Analysis finalized! Loading threat intelligence report...");

        if (onScanStart) {
          onScanStart(targetSha, selectedFile.name);
        }

        setTimeout(() => {
          navigate({
            to: "/report/$type/$id",
            params: { type: "file", id: targetSha },
          });
        }, 500);
      } else {
        setIsUploading(false);
        setUploadError(res.error || "VirusTotal could not process this upload.");
        setStatusText("Upload failed.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setIsUploading(false);
      setUploadError("Network connection interrupted during file transmission.");
      setStatusText("Upload failed.");
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setComputedHash(null);
    setFileBase64(null);
    setProgress(0);
    setStatusText("");
    setKnownReport(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      {!selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "panel-metal texture-brush group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300",
            dragOver
              ? "border-primary bg-primary/10 shadow-[0_0_35px_rgba(6,182,212,0.25)] scale-[1.01]"
              : "border-white/15 hover:border-primary/50 hover:bg-white/[0.03]",
          )}
        >
          {/* Scanning Radar Accent */}
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_-4px] shadow-primary/30 group-hover:scale-105 group-hover:shadow-primary/50 transition-all duration-300">
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
            Drop your file here, or <span className="text-cyan-glow underline underline-offset-4">browse</span>
          </h3>
          <p className="mt-2 max-w-md font-mono text-xs text-muted-foreground">
            Fast in-browser SHA-256 computation with live multi-vendor VirusTotal threat analysis.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.68rem] text-muted-foreground">
              PE / EXE / DLL
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.68rem] text-muted-foreground">
              PDF / Office Docs
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.68rem] text-muted-foreground">
              ZIP / 7Z / TAR
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.68rem] text-muted-foreground">
              Scripts & Binaries
            </span>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="panel-metal texture-brush relative overflow-hidden rounded-2xl border border-white/15 p-6">
          {/* Top File Meta */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-semibold text-foreground">
                  {selectedFile.name}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {formatBytes(selectedFile.size)} · {selectedFile.type || "application/octet-stream"}
                </div>
              </div>
            </div>

            <button
              onClick={resetSelection}
              disabled={isComputing || isUploading}
              className="button-metal rounded-lg px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Change File
            </button>
          </div>

          {/* Progress / Status Section */}
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-primary flex items-center gap-2">
                {isComputing || isUploading ? (
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                ) : knownReport ? (
                  <span className="h-2 w-2 rounded-full bg-success" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                )}
                {statusText}
              </span>
              <span className="font-bold tabular-nums text-foreground">{progress}%</span>
            </div>

            {/* Glowing Sci-Fi Progress Bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Computed Hash Box */}
          {computedHash && (
            <div className="mt-6 space-y-4 animate-fade-up">
              <div className="rounded-xl border border-primary/30 bg-black/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="label-tactical text-primary">SHA-256 Cryptographic Hash</span>
                  <button
                    onClick={handleCopyHash}
                    className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                  >
                    {copied ? "COPIED!" : "COPY HASH"}
                  </button>
                </div>
                <div className="mt-1.5 break-all font-mono text-xs font-semibold text-cyan-glow">
                  {computedHash}
                </div>
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive">
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Action Buttons based on status */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {knownReport ? (
                  <>
                    <div className="flex items-center gap-2 font-mono text-xs text-success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Analysis record located in VirusTotal network</span>
                    </div>

                    <button
                      onClick={handleOpenExistingReport}
                      className="button-cta w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl px-7 py-3 font-display text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View Threat Intelligence Report
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-warning animate-pulse-glow" />
                      <span>Ready to scan across 70+ vendor engines</span>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleUploadAndScan}
                        disabled={isUploading}
                        className="button-cta flex-1 sm:flex-initial flex items-center justify-center gap-2.5 rounded-xl px-6 py-3 font-display text-sm font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] disabled:opacity-60"
                      >
                        {isUploading ? (
                          <>
                            <span className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                            Uploading & Analyzing...
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Submit & Scan on VirusTotal
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleOpenExistingReport}
                        disabled={isUploading}
                        className="button-metal flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        title="Query hash directly if already scanned"
                      >
                        Lookup Hash
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
