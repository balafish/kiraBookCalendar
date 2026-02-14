interface Props {
  readCount: number;
  totalCount: number;
}

export default function ProgressRing({ readCount, totalCount }: Props) {
  const progress = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  return (
    <div className="rc-inline-progress">
      <span className="rc-progress-text">
        {readCount}<span>/{totalCount}</span>
      </span>
      <div
        className="rc-ring-small"
        style={{
          background: `conic-gradient(#6b8f71 ${progress}%, #2a2520 ${progress}%)`,
        }}
      >
        <div className="rc-ring-small-inner">{progress}%</div>
      </div>
    </div>
  );
}
