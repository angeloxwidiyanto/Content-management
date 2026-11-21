import React, { useMemo, useRef, useState } from 'react';
import { Hash, Plus, X } from 'lucide-react';
import {
  StrategyType,
  TAG_SUGGESTIONS_BY_STRATEGY,
  normalizeTag,
  normalizeTagList,
} from '../types/content';

interface TagInputFieldProps {
  id: string;
  label: string;
  tags: string[];
  onChange: (nextTags: string[]) => void;
  strategy: StrategyType;
  existingTags?: string[];
  placeholder?: string;
  maxTags?: number;
  helperText?: string;
}

export function TagInputField({
  id,
  label,
  tags,
  onChange,
  strategy,
  existingTags = [],
  placeholder = 'Type a tag and press Enter or comma...',
  maxTags = 12,
  helperText = 'Press Enter or comma to add · Backspace removes the last tag',
}: TagInputFieldProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commitRawInput = (raw: string) => {
    if (!raw.trim()) return;
    const incoming = normalizeTagList([raw]);
    if (incoming.length === 0) {
      setDraft('');
      return;
    }
    const merged = normalizeTagList([...tags, ...incoming]).slice(0, maxTags);
    onChange(merged);
    setDraft('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        commitRawInput(draft);
      } else if (e.key === ',') {
        e.preventDefault();
      }
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes(',') || pasted.includes('\n')) {
      e.preventDefault();
      commitRawInput(pasted.replace(/\n/g, ','));
    }
  };

  const availableSuggestions = useMemo(() => {
    const selectedSet = new Set(tags);
    const merged = normalizeTagList([
      ...existingTags,
      ...TAG_SUGGESTIONS_BY_STRATEGY[strategy],
    ]);
    const cleanQuery = normalizeTag(draft);
    return merged
      .filter((t) => !selectedSet.has(t))
      .filter((t) => (!cleanQuery ? true : t.includes(cleanQuery)))
      .slice(0, 8);
  }, [tags, existingTags, strategy, draft]);

  const atLimit = tags.length >= maxTags;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="block text-[12px] font-medium text-[#515154]"
        >
          {label}
        </label>
        <span className="font-mono text-[11px] tabular-nums text-[#6E6E73]">
          {tags.length}/{maxTags}
        </span>
      </div>

      {/* Interactive Tag Container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[42px] px-2.5 py-1.5 bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus-within:bg-white border border-black/[0.09] focus-within:border-[#0071E3] focus-within:ring-[3px] focus-within:ring-[#0071E3]/18 rounded-[9px] transition-all flex flex-wrap items-center gap-1.5 cursor-text"
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[12px] font-mono text-[#1D1D1F] bg-white border border-black/[0.1] rounded-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]"
          >
            <span className="text-[#0071E3]" aria-hidden="true">
              #
            </span>
            <span>{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              aria-label={`Remove tag ${tag}`}
              className="p-0.5 text-[#86868B] hover:text-[#D70015] hover:bg-black/[0.05] rounded-[4px] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {!atLimit && (
          <div className="flex-1 min-w-[140px] flex items-center gap-1.5">
            <Hash
              className="w-3.5 h-3.5 text-[#86868B] shrink-0 ml-0.5"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id={id}
              type="text"
              value={draft}
              onChange={(e) => {
                const value = e.target.value;
                if (value.endsWith(',')) {
                  commitRawInput(value.slice(0, -1));
                } else {
                  setDraft(value);
                }
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={() => {
                if (draft.trim()) {
                  commitRawInput(draft);
                }
              }}
              placeholder={tags.length === 0 ? placeholder : 'Add tag...'}
              className="w-full py-0.5 text-[13px] font-mono bg-transparent text-[#1D1D1F] placeholder:text-[#86868B] placeholder:font-sans focus:outline-none"
            />
            {draft.trim() && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitRawInput(draft);
                }}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-[#0071E3] hover:bg-[#0071E3]/[0.09] rounded-[6px] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick-Add Suggestions + Helper */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E6E73]">
        {availableSuggestions.length > 0 && !atLimit ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[#86868B] mr-0.5">Quick add:</span>
            {availableSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() =>
                  onChange(
                    normalizeTagList([...tags, suggestion]).slice(0, maxTags)
                  )
                }
                className="px-1.5 py-0.5 font-mono text-[11px] text-[#515154] hover:text-[#0071E3] hover:bg-[#0071E3]/[0.08] rounded-[5px] transition-colors whitespace-nowrap"
              >
                +{suggestion}
              </button>
            ))}
          </div>
        ) : (
          <span>{atLimit ? `Maximum of ${maxTags} tags reached.` : helperText}</span>
        )}
      </div>
    </div>
  );
}
