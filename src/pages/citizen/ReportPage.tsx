import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ChevronRight, ChevronLeft, CheckCircle2, Upload, X, AlertCircle
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { api } from '../../services/api';
import type { IncidentType } from '../../data/types';
import { cn } from '../../lib/cn';

const INCIDENT_TYPES: { value: IncidentType; label: string; emoji: string }[] = [
  { value: 'fire', label: 'Fire', emoji: '🔥' },
  { value: 'flood', label: 'Flood', emoji: '🌊' },
  { value: 'accident', label: 'Road Accident', emoji: '🚗' },
  { value: 'structural', label: 'Building / Structural Damage', emoji: '🏚️' },
  { value: 'landslide', label: 'Landslide', emoji: '⛰️' },
  { value: 'weather', label: 'Severe Weather', emoji: '⛈️' },
  { value: 'other', label: 'Other', emoji: '⚠️' },
];

interface FormData {
  type: IncidentType | null;
  description: string;
  locationName: string;
  mediaFiles: { url: string; name: string; file: File }[];
  location: { lat: number; lng: number } | null;
  peopleTrapped: string;
  injuries: string;
  medicalNeeded: boolean;
}

const STEPS = ['What happened?', 'Where?', 'What did you see?', 'Evidence', 'Review'];

export function ReportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; referenceCode: string } | null>(null);
  const [form, setForm] = useState<FormData>({
    type: null,
    description: '',
    locationName: '',
    mediaFiles: [],
    location: null,
    peopleTrapped: '',
    injuries: '',
    medicalNeeded: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Choose a JPEG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError('The image must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }
    setFormError(null);
    setForm(prev => ({
      ...prev,
      mediaFiles: [{ url: URL.createObjectURL(file), name: file.name, file }],
    }));
  };

  const removeMedia = (idx: number) => {
    URL.revokeObjectURL(form.mediaFiles[idx].url);
    setForm(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, i) => i !== idx),
    }));
  };

  useEffect(() => () => {
    form.mediaFiles.forEach(item => URL.revokeObjectURL(item.url));
  }, [form.mediaFiles]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setFormError('Location detection is unavailable. Enter a landmark instead.');
      return;
    }
    setLocating(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setForm(prev => ({ ...prev, location }));
        setLocating(false);
      },
      () => {
        setFormError('Could not detect your location. Enter a landmark instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const canNext = () => {
    if (step === 0) return form.type !== null;
    if (step === 1) return form.location !== null || form.locationName.trim().length > 0;
    if (step === 2) return form.description.trim().length > 0;
    if (step === 3 && form.peopleTrapped) {
      const count = Number(form.peopleTrapped);
      return Number.isSafeInteger(count) && count >= 0;
    }
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.submitReport({
        type: form.type!,
        description: form.description,
        location: form.location,
        locationName: form.locationName,
        image: form.mediaFiles[0]?.file ?? null,
        peopleTrapped: form.peopleTrapped ? Number(form.peopleTrapped) : null,
        medicalNeeded: form.medicalNeeded,
      });
      setSubmitted(result);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not submit the report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-1">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-green-600" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Report submitted</h1>
          <p className="text-slate-500 mb-2">
            Your report was saved and is being analyzed for nearby incident matches.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg">
            <span className="text-xs text-slate-500">Reference:</span>
            <span className="text-sm font-mono font-bold text-slate-800">{submitted.referenceCode}</span>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            You can track your report status in <strong>My Reports</strong>.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={() => navigate('/reports')}
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              View My Reports
            </button>
            <button
              onClick={() => { setSubmitted(null); setStep(0); setForm({ type: null, description: '', locationName: '', mediaFiles: [], location: null, peopleTrapped: '', injuries: '', medicalNeeded: false }); }}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-slate-900">Report an Incident</h1>
            <span className="text-sm text-slate-400 font-medium">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemax={STEPS.length}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">{STEPS[step]}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-card">
          {/* Step 0: Type */}
          {step === 0 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-4">What happened?</h2>
              <div className="grid grid-cols-1 gap-2">
                {INCIDENT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all',
                      form.type === t.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    )}
                    aria-pressed={form.type === t.value}
                  >
                    <span className="text-xl" aria-hidden>{t.emoji}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                    {form.type === t.value && (
                      <CheckCircle2 size={16} className="ml-auto" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Where did it happen?</h2>
              <div className="bg-slate-100 rounded-xl min-h-40 flex items-center justify-center mb-4 border border-slate-200 p-5">
                <div className="text-center">
                  <MapPin size={24} className="text-blue-600 mx-auto mb-2" aria-hidden />
                  <p className="text-sm font-medium text-slate-700">
                    {form.location ? 'Location detected' : 'Add a precise location (optional)'}
                  </p>
                  {form.location && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {form.location.lat}°N, {form.location.lng}°E
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locating}
                    className="mt-3 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {locating ? 'Detecting…' : form.location ? 'Refresh location' : 'Use current location'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="location">
                  Location name
                </label>
                <input
                  id="location"
                  type="text"
                  value={form.locationName}
                  onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="Describe the location..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Description */}
          {step === 2 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-4">What did you see?</h2>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={6}
                placeholder="Describe what you observed. Include any details about the severity, location, or number of people affected..."
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                aria-label="Describe the incident"
              />
              {form.description.trim().length === 0 && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} aria-hidden /> Please describe what you observed.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Media */}
          {step === 3 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Add evidence (optional)</h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload media"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-xl py-8 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <Upload size={24} className="text-slate-400" aria-hidden />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Upload one photo</p>
                  <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG or WebP · up to 10 MB</p>
                </div>
              </button>

              {form.mediaFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {form.mediaFiles.map((f, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <img
                        src={f.url}
                        alt={f.name}
                        className="w-full h-full object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        onClick={() => removeMedia(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Additional info */}
              <div className="mt-6 space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Additional information (optional)</h3>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1" htmlFor="trapped">
                    Estimated people trapped or at risk
                  </label>
                  <input
                    id="trapped"
                    type="number"
                    min="0"
                    value={form.peopleTrapped}
                    onChange={e => setForm(f => ({ ...f, peopleTrapped: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="medical"
                    type="checkbox"
                    checked={form.medicalNeeded}
                    onChange={e => setForm(f => ({ ...f, medicalNeeded: e.target.checked }))}
                    className="w-4 h-4 accent-red-600"
                  />
                  <label className="text-sm text-slate-600" htmlFor="medical">
                    Medical assistance appears needed
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Review your report</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-sm text-slate-500 w-24 flex-shrink-0">Type</span>
                  <span className="text-sm font-medium text-slate-800">
                    {INCIDENT_TYPES.find(t => t.value === form.type)?.label}
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-sm text-slate-500 w-24 flex-shrink-0">Location</span>
                  <span className="text-sm font-medium text-slate-800">
                    {form.locationName || (form.location ? `${form.location.lat}, ${form.location.lng}` : 'Not provided')}
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-sm text-slate-500 w-24 flex-shrink-0">Description</span>
                  <span className="text-sm text-slate-700">{form.description}</span>
                </div>
                {form.mediaFiles.length > 0 && (
                  <div className="flex gap-3">
                    <span className="text-sm text-slate-500 w-24 flex-shrink-0">Media</span>
                    <span className="text-sm font-medium text-slate-800">
                      {form.mediaFiles.length} file{form.mediaFiles.length !== 1 ? 's' : ''} attached
                    </span>
                  </div>
                )}
                {form.peopleTrapped && (
                  <div className="flex gap-3">
                    <span className="text-sm text-slate-500 w-24 flex-shrink-0">At risk</span>
                    <span className="text-sm font-medium text-slate-800">{form.peopleTrapped} people</span>
                  </div>
                )}
                {form.medicalNeeded && (
                  <div className="flex gap-3">
                    <span className="text-sm text-slate-500 w-24 flex-shrink-0">Medical</span>
                    <span className="text-sm font-medium text-red-700">Assistance appears needed</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-6 border-t border-slate-100 pt-4">
                Your report will be anonymized, analyzed, and may be combined with other nearby reports. You can track its status in My Reports.
              </p>
            </div>
          )}
        </div>

        {formError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden /> {formError}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-4 flex justify-between gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext() || submitting}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                canNext()
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              Continue <ChevronRight size={16} aria-hidden />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
