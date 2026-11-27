import React from "react";
import { EmojiPicker } from "frimousse";
import { Search } from "lucide-react";

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
}

const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  onSelect,
}) => {
  return (
    <EmojiPicker.Root
      columns={8}
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
      className="flex flex-col w-80 max-w-[92vw] h-80 rounded-xl bg-[#FAF9F6] dark:bg-[#1F1F1D] text-[#1C1917] dark:text-[#EDEDEB] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-2xl overflow-hidden isolate"
    >
      {/* Search Bar */}
      <div className="p-2 border-b border-[#E7E5E0] dark:border-[#282825] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#78716C] dark:text-[#8A8985] absolute left-2.5 pointer-events-none" />
          <EmojiPicker.Search
            autoFocus
            placeholder="Search emojis by label…"
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-[#F4F2EC] dark:bg-[#262623] text-[#1C1917] dark:text-[#EDEDEB] placeholder:text-[#78716C]/70 dark:placeholder:text-[#8A8985]/70 outline-hidden focus:ring-1 focus:ring-amber-500/60"
          />
        </div>
      </div>

      {/* Scrollable Emoji Grid */}
      <EmojiPicker.Viewport className="relative flex-1 outline-hidden overflow-y-auto custom-scrollbar">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-xs text-[#78716C] dark:text-[#8A8985]">
          Loading emojis…
        </EmojiPicker.Loading>

        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-[#78716C] dark:text-[#8A8985] px-4 text-center">
          {({ search }) => `No emoji found for "${search}"`}
        </EmojiPicker.Empty>

        <EmojiPicker.List
          className="select-none pb-2"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                className="bg-[#FAF9F6]/95 dark:bg-[#1F1F1D]/95 backdrop-blur-xs px-3 pt-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-[#78716C] dark:text-[#8A8985]"
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="px-2">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                type="button"
                title={emoji.label}
                aria-label={emoji.label}
                className={`flex items-center justify-center w-9 h-9 rounded-lg text-lg transition-colors cursor-pointer ${
                  emoji.isActive
                    ? "bg-[#EFECE4] dark:bg-[#2D2D29]"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>

      {/* Active / Hovered Emoji Label Footer + Skin Tone */}
      <div className="h-9 px-3 border-t border-[#E7E5E0] dark:border-[#282825] bg-[#F4F2EC]/70 dark:bg-[#181816] flex items-center justify-between gap-2 shrink-0">
        <EmojiPicker.ActiveEmoji>
          {({ emoji }) =>
            emoji ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none shrink-0">
                  {emoji.emoji}
                </span>
                <span className="text-xs text-[#57534E] dark:text-[#B8B6B0] truncate capitalize">
                  {emoji.label}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[#78716C] dark:text-[#8A8985] truncate">
                Hover or search an emoji…
              </span>
            )
          }
        </EmojiPicker.ActiveEmoji>

        <EmojiPicker.SkinToneSelector
          title="Change skin tone"
          className="w-6 h-6 rounded-md flex items-center justify-center text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        />
      </div>
    </EmojiPicker.Root>
  );
};

export default EmojiPickerPopover;
