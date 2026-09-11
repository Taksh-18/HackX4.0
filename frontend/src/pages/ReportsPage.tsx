import { useState } from "react";
import { submitReport, uploadMedia } from "../api/incidents";
import { ApiError } from "../api/client";
import { Icon } from "../components/Icon";

interface Coords {
  lat: number;
  lon: number;
}

const HAZARD_TAGS = [
  { label: "Flooding / Waterlogging", icon: "water_drop" },
  { label: "People Trapped", icon: "group_off" },
  { label: "Structural Collapse", icon: "domain_disabled" },
  { label: "Downed Powerline", icon: "bolt" },
  { label: "Medical Emergency", icon: "medical_services" },
];

const DANGER_OPTIONS = [
  { value: "None", label: "None", icon: "sentiment_satisfied" },
  { value: "1-3", label: "1 – 3", icon: "person" },
  { value: "4-6", label: "4 – 6", icon: "group" },
  { value: "More than 6", label: "More than 6", icon: "groups" },
];

export function ReportsPage() {
  const [tags, setTags] = useState<string[]>([]);
  const [danger, setDanger] = useState("1-3");
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);

  const toggleTag = (label: string) => {
    setTags((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]));
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Could not get your location. You can still submit without it.");
        setLocating(false);
      },
    );
  };

  const buildRawText = () => {
    const parts: string[] = [];
    tags.forEach((t) => parts.push(`[${t}]`));
    if (danger !== "None") parts.push(`[${danger} people in danger]`);
    if (description.trim()) parts.push(description.trim());
    if (landmark.trim()) parts.push(`Near ${landmark.trim()}.`);
    return parts.join(" ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const rawText = buildRawText();
    if (!rawText) {
      setError("Please describe what is happening.");
      return;
    }
    setSubmitting(true);
    setPhotoWarning(null);
    try {
      let mediaUrl: string | null = null;
      if (photo) {
        try {
          mediaUrl = (await uploadMedia(photo)).media_url;
        } catch (uploadErr) {
          const detail = uploadErr instanceof ApiError ? uploadErr.message : "upload failed";
          setPhotoWarning(`Photo upload failed (${detail}) — report was submitted without it.`);
        }
      }
      await submitReport({
        source_user: name.trim() || "anonymous",
        raw_text: rawText,
        media_url: mediaUrl,
        gps_lat: coords?.lat ?? null,
        gps_lon: coords?.lon ?? null,
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong submitting your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setTags([]);
    setDanger("1-3");
    setDescription("");
    setLandmark("");
    setName("");
    setPhoto(null);
    setCoords(null);
    setPhotoWarning(null);
  };

  if (submitted) {
    return (
      <div className="flex justify-center bg-surface px-4 py-8">
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-status-green-solid" />
                <span className="text-[15px] font-semibold text-on-surface">
                  Status: Report Received
                </span>
              </div>
            </div>
            {photoWarning && (
              <div className="flex items-start gap-2 rounded-lg bg-status-amber-bg p-2 text-status-amber">
                <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
                <span className="text-[13px]">{photoWarning}</span>
              </div>
            )}
            <p className="text-[14px] leading-relaxed text-on-surface">
              Your report is being processed by the CDIS pipeline — relevance filtering, then
              geolocation and corroboration against nearby reports. Responders see verified,
              prioritized incidents on the Intelligence queue as they're derived from real reports
              like yours.
            </p>
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-lg bg-surface-low p-2">
                <Icon name="check_circle" size={20} style={{ color: "#15803D" }} className="mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-on-surface">1. Received</span>
                  <span className="text-xs text-on-surface-variant">Queued for processing</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-surface-high p-2">
                <Icon name="sync" size={20} className="mt-0.5 shrink-0 animate-spin text-secondary" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-on-surface">2. Verification</span>
                  <span className="text-xs text-on-surface-variant">Relevance + geolocation</span>
                </div>
              </div>
            </div>
          </section>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-[#c6c6cd] bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-low"
          >
            Submit another report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-surface px-4 py-8">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <header className="flex flex-col gap-1.5 rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <span className="inline-flex h-2 w-2 rounded-full bg-status-critical-solid" />
            <span>CDIS Citizen Dispatch Link · Secure Incident Reporting</span>
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-on-surface sm:text-[28px]">
            Submit an Emergency Observation
          </h1>
          <p className="text-[14px] leading-relaxed text-on-surface-variant">
            Your report is processed immediately to direct responders where they are needed most.
            Please share calm, clear facts if it is safe to do so.
          </p>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-surface-low p-2 text-on-surface">
            <Icon name="shield_with_heart" size={20} style={{ color: "#BA1A1A" }} className="shrink-0" />
            <span className="text-[13px]">
              <strong className="font-semibold">Life in immediate danger?</strong> Also dial your
              local emergency line directly if feasible.
            </span>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-xl border border-[#c6c6cd] bg-white p-5 shadow-sm sm:p-6"
        >
          {/* 1. What is happening? */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="description" className="flex items-center gap-1 text-[15px] font-semibold text-on-surface">
                <span>1. What is happening?</span>
                <span className="text-xs text-status-critical">*</span>
              </label>
              <span className="text-xs text-on-surface-variant">Tap tags for rapid input</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HAZARD_TAGS.map((tag) => {
                const active = tags.includes(tag.label);
                return (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => toggleTag(tag.label)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors"
                    style={
                      active
                        ? { backgroundColor: "#141b2b", color: "#ffffff" }
                        : { backgroundColor: "#e7eefe", color: "#151c27" }
                    }
                  >
                    <Icon name={tag.icon} size={16} style={active ? { color: "#ffffff" } : undefined} />
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              id="description"
              required={tags.length === 0}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g., Water rising rapidly near Metro Pillar 42, several people trapped on steps needing rescue..."
              className="w-full resize-none rounded-lg bg-surface-low p-3 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:bg-white focus:outline-none"
            />
            <span className="text-xs text-on-surface-variant">
              Provide key visual points: water depth, blocked paths, or visible hazards.
            </span>
          </div>

          {/* 2. People in immediate danger? */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-1 text-[15px] font-semibold text-on-surface">
              <span>2. People in immediate danger?</span>
              <span className="text-xs text-status-critical">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {DANGER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDanger(opt.value)}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 text-center text-[14px] font-medium transition-colors"
                  style={
                    danger === opt.value
                      ? { backgroundColor: "#141b2b", color: "#ffffff" }
                      : { backgroundColor: "#f0f3ff", color: "#151c27" }
                  }
                >
                  <Icon name={opt.icon} size={20} style={danger === opt.value ? { color: "#ffffff" } : undefined} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Location */}
          <div className="flex flex-col gap-2">
            <label className="text-[15px] font-semibold text-on-surface">3. Where are you located?</label>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={requestLocation}
                disabled={locating}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-black px-4 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
              >
                <Icon name={locating ? "sync" : "near_me"} size={18} className={locating ? "animate-spin" : ""} />
                <span>{locating ? "Locating..." : coords ? "Update location" : "Use My Current Location"}</span>
              </button>
              <div className="flex items-center gap-1.5 rounded-lg bg-surface-low px-3 py-2 font-mono text-xs text-on-surface-variant">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: coords ? "#15803D" : "#515f74" }}
                />
                <span>
                  {coords
                    ? `GPS locked: ${coords.lat.toFixed(4)}° N, ${coords.lon.toFixed(4)}° E`
                    : "No GPS captured yet"}
                </span>
              </div>
            </div>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Or enter street, metro pillar number, or prominent landmark"
              className="mt-1 w-full rounded-lg bg-surface-low px-3 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:bg-white focus:outline-none"
            />
            {coords && (
              <div className="relative h-36 w-full overflow-hidden rounded-lg bg-surface-container shadow-inner">
                <img
                  src={`https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lon}&zoom=15&size=600x220&markers=${coords.lat},${coords.lon},red-pushpin`}
                  alt="Map preview of your location"
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 shadow-md backdrop-blur">
                  <Icon name="location_on" size={16} style={{ color: "#BA1A1A" }} />
                  <span className="font-mono text-xs text-on-surface">
                    {coords.lat.toFixed(4)}° N, {coords.lon.toFixed(4)}° E
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Photo */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="photo" className="text-[15px] font-semibold text-on-surface">
                4. Photo or Video Evidence
              </label>
              <span className="text-xs text-on-surface-variant">Crucial for rescue speed</span>
            </div>
            {!photo ? (
              <label
                htmlFor="photo"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl bg-surface-low p-5 text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface">
                  <Icon name="add_a_photo" size={22} />
                </div>
                <span className="text-[14px] font-semibold text-on-surface">
                  Upload real-time photo of the scene
                </span>
                <span className="max-w-md text-xs text-on-surface-variant">
                  Fresh smartphone photos help responders verify the situation quickly.
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-2 shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                    <Icon name="image" size={22} />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-1">
                      <Icon name="check_circle" size={16} style={{ color: "#15803D" }} />
                      <span className="truncate text-[13px] font-semibold text-on-surface">
                        Photo attached
                      </span>
                    </div>
                    <span className="truncate font-mono text-xs text-on-surface-variant">
                      {photo.name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                  className="p-1 text-on-surface-variant hover:text-status-critical"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            )}
            <input
              id="photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* 5. Contact */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label className="text-[15px] font-semibold text-on-surface">
                5. Your Name{" "}
                <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
              </label>
              <span className="text-xs text-on-surface-variant">Never shared publicly</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Citizen Reporter"
              className="w-full rounded-lg bg-surface-low px-3 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:bg-white focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-status-critical">{error}</p>}

          <div className="flex flex-col gap-1.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-status-critical-solid px-6 py-3 text-[15px] font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-60"
            >
              <Icon name={submitting ? "sync" : "send"} size={20} className={submitting ? "animate-spin" : ""} />
              <span>{submitting ? "SUBMITTING..." : "SUBMIT EMERGENCY REPORT"}</span>
            </button>
            <p className="text-center text-xs text-on-surface-variant">
              By submitting, you affirm this report is accurate to the best of your observation.
            </p>
          </div>
        </form>

        <footer className="py-2 text-center text-xs text-on-surface-variant">
          Incident Ops CDIS Citizen Portal · Reports route to the responder Intelligence queue
        </footer>
      </div>
    </div>
  );
}
