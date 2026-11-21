import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CHANNELS,
  CHANNEL_MAP,
  CONTENT_MODELS_BY_STRATEGY,
  CTA_PRESETS_BY_STRATEGY,
  ChannelId,
  ContentFormat,
  ContentProject,
  FUNNEL_GROUPS,
  StrategyType,
  WorkflowStatus,
  normalizeTagList,
} from '../types/content';
import { TagInputField } from './TagInputField';

interface NewProjectModalProps {
  open: boolean;
  initialDate: string | null;
  initialStatus?: WorkflowStatus | null;
  existingTags?: string[];
  onClose: () => void;
  onCreate: (
    draft: Omit<
      ContentProject,
      'id' | 'folderCode' | 'createdAt' | 'updatedAt' | 'milestones' | 'assets' | 'metrics'
    >
  ) => void;
}

const inputBaseClass =
  'w-full px-3 py-2 text-[13.5px] bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.09] rounded-[9px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all';

export function NewProjectModal({
  open,
  initialDate,
  initialStatus = null,
  existingTags = [],
  onClose,
  onCreate,
}: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [strategy, setStrategy] = useState<StrategyType>('internal');
  const [format, setFormat] = useState<ContentFormat>('slide');
  const [contentModel, setContentModel] = useState(
    CONTENT_MODELS_BY_STRATEGY.internal[0]
  );
  const [ctaLabel, setCtaLabel] = useState(CTA_PRESETS_BY_STRATEGY.internal[0]);
  const [ctaDestination, setCtaDestination] = useState('');
  const [channel, setChannel] = useState<ChannelId>('warta_mimbar');
  const [status, setStatus] = useState<WorkflowStatus>(
    initialDate ? 'scheduled' : 'backlog'
  );
  const [scheduledDate, setScheduledDate] = useState<string>(initialDate ?? '');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [assigneeName, setAssigneeName] = useState('Nadia Pratama');
  const [campaign, setCampaign] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [briefNotes, setBriefNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setScheduledDate(initialDate ?? '');
      setStatus(initialStatus ?? (initialDate ? 'scheduled' : 'backlog'));
      setError('');
    }
  }, [open, initialDate, initialStatus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleStrategyChange = (nextStrategy: StrategyType) => {
    setStrategy(nextStrategy);
    setContentModel(CONTENT_MODELS_BY_STRATEGY[nextStrategy][0]);
    setCtaLabel(CTA_PRESETS_BY_STRATEGY[nextStrategy][0]);
    if (nextStrategy === 'internal') {
      setChannel('warta_mimbar');
      setFormat('slide');
    } else {
      setChannel('ig_post');
      setFormat('slide');
    }
  };

  const handleChannelChange = (nextChannel: ChannelId) => {
    setChannel(nextChannel);
    const meta = CHANNEL_MAP[nextChannel];
    if (meta) {
      setFormat(meta.defaultFormat);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Enter a project title to create its folder.');
      return;
    }

    onCreate({
      title: cleanTitle,
      summary:
        summary.trim() ||
        `${strategy === 'internal' ? 'Internal' : 'External'} ${format} content using ${contentModel} model.`,
      strategy,
      format,
      contentModel,
      ctaLabel: ctaLabel.trim() || CTA_PRESETS_BY_STRATEGY[strategy][0],
      ctaDestination: ctaDestination.trim(),
      channel,
      status: scheduledDate
        ? status === 'backlog'
          ? 'scheduled'
          : status
        : status,
      scheduledDate: scheduledDate || null,
      scheduledTime,
      assigneeName: assigneeName.trim() || 'Unassigned',
      campaign: campaign.trim() || 'General Editorial',
      tags: normalizeTagList(tags),
      briefNotes: briefNotes.trim(),
    });

    setTitle('');
    setSummary('');
    setCtaDestination('');
    setCampaign('');
    setTags([]);
    setBriefNotes('');
    onClose();
  };

  const modelOptions = CONTENT_MODELS_BY_STRATEGY[strategy];
  const ctaPresets = CTA_PRESETS_BY_STRATEGY[strategy];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-project-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="apple-glass-sheet rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
              <div>
                <h2
                  id="new-project-modal-title"
                  className="text-[16px] font-semibold text-[#1D1D1F] tracking-[-0.02em]"
                >
                  Create Content Project Folder
                </h2>
                <p className="text-[12px] text-[#6E6E73] mt-0.5">
                  Initializes a dedicated folder with metadata, production timeline, media assets, and live performance tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[9px] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="text-[12px] font-medium text-[#D70015] bg-[#D70015]/[0.06] border border-[#D70015]/20 px-3.5 py-2.5 rounded-[10px]">
                  {error}
                </div>
              )}

              {/* Strategy & Format Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#515154] mb-1.5">
                    Content Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-[3px] bg-black/[0.05] rounded-[9px]">
                    {(['internal', 'external'] as StrategyType[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={strategy === item}
                        onClick={() => handleStrategyChange(item)}
                        className={`py-1.5 px-3 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap ${
                          strategy === item
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        {item === 'internal' ? 'Internal' : 'External'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#515154] mb-1.5">
                    Deliverable Format
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-[3px] bg-black/[0.05] rounded-[9px]">
                    {(['slide', 'video'] as ContentFormat[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={format === item}
                        onClick={() => setFormat(item)}
                        className={`py-1.5 px-3 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap ${
                          format === item
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        {item === 'slide' ? 'Slide / Deck' : 'Video'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="proj-title"
                  className="block text-[12px] font-medium text-[#515154] mb-1.5"
                >
                  Project Title
                </label>
                <input
                  id="proj-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    strategy === 'internal'
                      ? 'e.g., Sunday Service Announcement Slides'
                      : 'e.g., 3 Takeaways From This Week’s Message'
                  }
                  className={inputBaseClass}
                  autoFocus
                />
              </div>

              {/* Channel & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="proj-channel"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Publishing Funnel
                  </label>
                  <select
                    id="proj-channel"
                    value={channel}
                    onChange={(e) => handleChannelChange(e.target.value as ChannelId)}
                    className={inputBaseClass}
                  >
                    {FUNNEL_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {CHANNELS.filter((c) => c.group === group).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="proj-model"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Content Model ({strategy === 'internal' ? 'Internal' : 'External'})
                  </label>
                  <select
                    id="proj-model"
                    value={contentModel}
                    onChange={(e) => setContentModel(e.target.value)}
                    className={inputBaseClass}
                  >
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CTA Label & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="proj-cta"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Primary Call-to-Action (CTA)
                  </label>
                  <input
                    id="proj-cta"
                    list="cta-presets-list"
                    type="text"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="Select or type custom CTA"
                    className={inputBaseClass}
                  />
                  <datalist id="cta-presets-list">
                    {ctaPresets.map((preset) => (
                      <option key={preset} value={preset} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="proj-cta-url"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    CTA Target Link or Action Note
                  </label>
                  <input
                    id="proj-cta-url"
                    type="text"
                    value={ctaDestination}
                    onChange={(e) => setCtaDestination(e.target.value)}
                    placeholder="https://... or keyword instruction"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              {/* Schedule, Time, Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="proj-date"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Publish Date (Optional)
                  </label>
                  <input
                    id="proj-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={`${inputBaseClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="proj-time"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Time Slot
                  </label>
                  <input
                    id="proj-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className={`${inputBaseClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="proj-owner"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Project Owner
                  </label>
                  <input
                    id="proj-owner"
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    className={inputBaseClass}
                  />
                </div>
              </div>

              {/* Summary & Campaign */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="proj-campaign"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Campaign / Pillar
                  </label>
                  <input
                    id="proj-campaign"
                    type="text"
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    placeholder="e.g., Weekly Ministry Spotlight"
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="proj-status"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Initial Workflow Stage
                  </label>
                  <select
                    id="proj-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
                    className={inputBaseClass}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="scripting">Scripting</option>
                    <option value="production">Production</option>
                    <option value="review">In Review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <TagInputField
                id="proj-tags"
                label="Custom Tags (searchable & filterable across workspace)"
                tags={tags}
                onChange={setTags}
                strategy={strategy}
                existingTags={existingTags}
                placeholder="e.g., retreat, sunday, qr-register"
              />

              <div>
                <label
                  htmlFor="proj-summary"
                  className="block text-[12px] font-medium text-[#515154] mb-1.5"
                >
                  Objective & Creative Brief
                </label>
                <textarea
                  id="proj-summary"
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Summarize key angle, audience takeaway, and production requirements..."
                  className={`${inputBaseClass} resize-none`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.07]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[10px] transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062CC] active:scale-[0.98] rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all whitespace-nowrap"
                >
                  Create Project Folder
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
