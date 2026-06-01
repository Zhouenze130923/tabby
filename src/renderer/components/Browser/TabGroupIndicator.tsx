/** 单个标签页上的小色点，指示所属分组 */
export function TabGroupDot({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      className="w-[6px] h-[6px] rounded-full shrink-0 inline-block"
      style={{ backgroundColor: color }}
    />
  );
}

/** 分组切换处显示的组名标签 */
export function TabGroupChip({
  name,
  color,
  onClick,
}: {
  name: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded shrink-0 whitespace-nowrap select-none border border-transparent hover:opacity-80 transition-opacity cursor-default"
      style={{
        backgroundColor: color + "18",
        color: color,
      }}
      title={`分组: ${name}`}
    >
      <span
        className="w-[5px] h-[5px] rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </button>
  );
}
