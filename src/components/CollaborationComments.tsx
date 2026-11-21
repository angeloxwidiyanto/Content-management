import React, { useMemo, useRef, useState } from 'react';
import {
  AtSign,
  Check,
  Clock,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  ContentProject,
  FolderComment,
  MediaAsset,
  TEAM_MEMBERS,
} from '../types/content';

interface CollaborationCommentsProps {
  project: ContentProject;
  comments: FolderComment[];
  onAddComment: (comment: Omit<FolderComment, 'id' | 'createdAt' | 'resolved'>) => void;
  onToggleResolve: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onInspectAsset: (asset: MediaAsset) => void;
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function renderFormattedBody(body: string) {
  const namesPattern = TEAM_MEMBERS.flatMap((m) => [m.name, m.handle])
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const splitRegex = new RegExp(`(@(?:${namesPattern}))`, 'gi');
  const exactMatchRegex = new RegExp(`^@(?:${namesPattern})$`, 'i');
  const parts = body.split(splitRegex);

  return parts.map((part, idx) => {
    if (exactMatchRegex.test(part)) {
      return (
        <span key={idx} className="font-semibold text-[#0071E3]">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function CollaborationComments({
  project,
  comments,
  onAddComment,
  onToggleResolve,
  onDeleteComment,
  onInspectAsset,
}: CollaborationCommentsProps) {
  const defaultAuthor =
    TEAM_MEMBERS.find((m) => m.name === project.assigneeName) ?? TEAM_MEMBERS[0];

  const [authorId, setAuthorId] = useState(defaultAuthor.id);
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [mentionedAssetId, setMentionedAssetId] = useState<string>('');
  const [assetTimestamp, setAssetTimestamp] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedAsset = useMemo(
    () => project.assets.find((a) => a.id === mentionedAssetId) ?? null,
    [project.assets, mentionedAssetId]
  );

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return TEAM_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.handle.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [mentionQuery]);

  const filteredComments = useMemo(() => {
    return comments.filter((c) => {
      if (statusFilter === 'open' && c.resolved) return false;
      if (statusFilter === 'resolved' && !c.resolved) return false;
      if (assetFilter !== 'all' && c.mentionedAssetId !== assetFilter) return false;
      return true;
    });
  }, [comments, statusFilter, assetFilter]);

  const openCount = useMemo(
    () => comments.filter((c) => !c.resolved).length,
    [comments]
  );

  const handleBodyChange = (val: string) => {
    setBody(val);
    const match = val.match(/(?:^|\s)@([a-zA-Z]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMentionFromQuery = (memberName: string) => {
    const nextBody = body.replace(/(?:^|\s)@([a-zA-Z]*)$/, (full) => {
      const leadingSpace = full.startsWith(' ') ? ' ' : '';
      return `${leadingSpace}@${memberName} `;
    });
    setBody(nextBody);
    setMentionQuery(null);
    setSelectedTags((prev) =>
      prev.includes(memberName) ? prev : [...prev, memberName]
    );
    textareaRef.current?.focus();
  };

  const handleToggleTagButton = (memberName: string) => {
    const exists = selectedTags.includes(memberName);
    if (exists) {
      setSelectedTags((prev) => prev.filter((t) => t !== memberName));
    } else {
      setSelectedTags((prev) => [...prev, memberName]);
      if (!body.includes(`@${memberName}`)) {
        setBody((prev) => {
          const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
          return `${prev}${spacer}@${memberName} `;
        });
      }
      textareaRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody) return;

    const author =
      TEAM_MEMBERS.find((m) => m.id === authorId) ?? TEAM_MEMBERS[0];

    const inlineTagged = TEAM_MEMBERS.filter(
      (m) =>
        cleanBody.toLowerCase().includes(`@${m.name.toLowerCase()}`) ||
        cleanBody.toLowerCase().includes(`@${m.handle.toLowerCase()}`)
    ).map((m) => m.name);

    const mergedTags = Array.from(new Set([...selectedTags, ...inlineTagged]));

    onAddComment({
      authorName: author.name,
      authorRole: author.role,
      body: cleanBody,
      taggedMembers: mergedTags,
      mentionedAssetId: selectedAsset ? selectedAsset.id : null,
      mentionedAssetName: selectedAsset ? selectedAsset.name : null,
      assetTimestamp: selectedAsset ? assetTimestamp.trim() : '',
    });

    setBody('');
    setSelectedTags([]);
    setMentionedAssetId('');
    setAssetTimestamp('');
    setMentionQuery(null);
  };

  const timestampPlaceholder =
    selectedAsset?.assetType === 'slide_deck'
      ? 'e.g., Slide 03'
      : selectedAsset?.assetType === 'script_doc'
      ? 'e.g., Line 14'
      : 'e.g., 00:42';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Composer Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
              Collaboration Comments
            </h3>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">
              Tag team members with <span className="font-mono">@</span> and reference specific media assets with timestamps or slide numbers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="comment-author"
              className="text-[11px] text-[#6E6E73] whitespace-nowrap"
            >
              Posting as
            </label>
            <select
              id="comment-author"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className="px-2.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] border border-black/[0.08] rounded-[9px] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
            >
              {TEAM_MEMBERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Textarea with @mention autocomplete dropdown */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={3}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Leave review feedback, type @ to tag a teammate, or reference a specific cut timestamp..."
            className="w-full px-3.5 py-2.5 text-[13.5px] bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.09] rounded-xl text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 leading-relaxed resize-none transition-all"
          />

          {mentionQuery !== null && mentionSuggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1.5 z-20 w-64 apple-glass-sheet rounded-xl py-1.5 overflow-hidden">
              <div className="px-3 py-1 text-[10.5px] font-semibold text-[#6E6E73] border-b border-black/[0.06]">
                Tag team member
              </div>
              {mentionSuggestions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMentionFromQuery(member.name)}
                  className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#0071E3]/[0.08] flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="font-medium text-[#1D1D1F]">{member.name}</span>
                  <span className="text-[11px] text-[#6E6E73]">{member.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tag Teammates Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6E6E73] mr-1">
            <AtSign className="w-3 h-3" />
            Tag:
          </span>
          {TEAM_MEMBERS.map((member) => {
            const active = selectedTags.includes(member.name);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleToggleTagButton(member.name)}
                className={`px-2.5 py-1 text-[12px] rounded-[8px] border transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
                  active
                    ? 'bg-[#0071E3]/[0.09] border-[#0071E3]/40 text-[#0071E3] font-semibold'
                    : 'bg-[#F5F5F7]/80 border-black/[0.07] text-[#515154] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                @{member.handle}
              </button>
            );
          })}
        </div>

        {/* Asset + Timestamp Attachment Row */}
        <div className="pt-3.5 border-t border-black/[0.06] flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3 flex-1 min-w-[260px]">
            <div className="flex-1 min-w-[200px] max-w-xs">
              <label
                htmlFor="comment-asset"
                className="flex items-center gap-1 text-[11px] font-medium text-[#515154] mb-1"
              >
                <Paperclip className="w-3 h-3 text-[#6E6E73]" />
                Mention Specific Asset (Optional)
              </label>
              <select
                id="comment-asset"
                value={mentionedAssetId}
                onChange={(e) => {
                  setMentionedAssetId(e.target.value);
                  if (!e.target.value) setAssetTimestamp('');
                }}
                className="w-full px-2.5 py-1.5 text-[12px] bg-[#F5F5F7]/75 focus:bg-white border border-black/[0.09] rounded-[9px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
              >
                <option value="">No specific asset linked</option>
                {project.assets.map((a, idx) => (
                  <option key={a.id} value={a.id}>
                    {String(idx + 1).padStart(2, '0')} · {a.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="w-36">
                <label
                  htmlFor="comment-timestamp"
                  className="flex items-center gap-1 text-[11px] font-medium text-[#515154] mb-1"
                >
                  <Clock className="w-3 h-3 text-[#6E6E73]" />
                  Timestamp / Ref
                </label>
                <input
                  id="comment-timestamp"
                  type="text"
                  value={assetTimestamp}
                  onChange={(e) => setAssetTimestamp(e.target.value)}
                  placeholder={timestampPlaceholder}
                  className="w-full px-2.5 py-1.5 text-[12px] font-mono tabular-nums bg-[#F5F5F7]/75 focus:bg-white border border-black/[0.09] rounded-[9px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!body.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062CC] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Post Comment
          </button>
        </div>
      </form>

      {/* Filter & Thread List */}
      <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/[0.07] bg-[#FAFAFC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]">
              {(
                [
                  { id: 'all', label: `All (${comments.length})` },
                  { id: 'open', label: `Open (${openCount})` },
                  { id: 'resolved', label: `Resolved (${comments.length - openCount})` },
                ] as { id: 'all' | 'open' | 'resolved'; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'apple-segment-active'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {project.assets.length > 0 && (
              <select
                aria-label="Filter comments by asset"
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="px-2.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white border border-black/[0.09] rounded-[9px] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
              >
                <option value="all">All Assets</option>
                {project.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <span className="text-[11px] font-mono tabular-nums text-[#6E6E73]">
            {filteredComments.length} shown
          </span>
        </div>

        {filteredComments.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <MessageSquare className="w-5 h-5 text-[#86868B] mx-auto mb-2" strokeWidth={1.6} />
            <p className="text-[13px] font-semibold text-[#1D1D1F]">
              No comments match this view
            </p>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">
              Start a review thread above by tagging a teammate or referencing a specific asset timestamp.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {filteredComments.map((comment) => {
              const linkedAsset = comment.mentionedAssetId
                ? project.assets.find((a) => a.id === comment.mentionedAssetId) ??
                  null
                : null;

              return (
                <article
                  key={comment.id}
                  className={`p-5 transition-colors ${
                    comment.resolved ? 'bg-[#FAFAFC]' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-semibold text-[#1D1D1F]">
                        {comment.authorName}
                      </span>
                      <span className="text-[#C7C7CC]" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-[#6E6E73]">{comment.authorRole}</span>
                      <span className="text-[#C7C7CC]" aria-hidden="true">
                        ·
                      </span>
                      <time
                        dateTime={comment.createdAt}
                        className="font-mono text-[11px] tabular-nums text-[#6E6E73]"
                      >
                        {formatCommentTime(comment.createdAt)}
                      </time>
                      {comment.resolved && (
                        <>
                          <span className="text-[#C7C7CC]" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[11px] font-semibold text-[#1F8A4C]">
                            Resolved
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleResolve(comment.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] rounded-[7px] transition-colors whitespace-nowrap"
                      >
                        {comment.resolved ? (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            Reopen
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Resolve
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.id)}
                        aria-label="Delete comment"
                        className="p-1.5 text-[#86868B] hover:text-[#D70015] hover:bg-[#D70015]/[0.06] rounded-[7px] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Comment Prose */}
                  <p
                    className={`text-[13.5px] leading-relaxed ${
                      comment.resolved ? 'text-[#6E6E73]' : 'text-[#1D1D1F]'
                    }`}
                  >
                    {renderFormattedBody(comment.body)}
                  </p>

                  {/* Clean Unboxed Metadata Footer */}
                  {(comment.taggedMembers.length > 0 || comment.mentionedAssetName) && (
                    <div className="mt-3 pt-2.5 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 text-[12px]">
                      <div className="flex flex-wrap items-center gap-2 text-[#6E6E73]">
                        {comment.mentionedAssetName && (
                          <div className="flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
                            {linkedAsset ? (
                              <button
                                type="button"
                                onClick={() => onInspectAsset(linkedAsset)}
                                className="font-medium text-[#0071E3] hover:underline truncate max-w-[260px]"
                              >
                                {comment.mentionedAssetName}
                              </button>
                            ) : (
                              <span className="text-[#1D1D1F]">
                                {comment.mentionedAssetName}
                              </span>
                            )}
                            {comment.assetTimestamp && (
                              <>
                                <span className="text-[#C7C7CC]" aria-hidden="true">
                                  /
                                </span>
                                <span className="font-mono tabular-nums font-medium text-[#1D1D1F]">
                                  @ {comment.assetTimestamp}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {comment.taggedMembers.length > 0 && (
                        <div className="text-[11px] text-[#6E6E73]">
                          Notified:{' '}
                          <span className="text-[#1D1D1F] font-medium">
                            {comment.taggedMembers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
