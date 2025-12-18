export default function Lock() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="48"
      height="48"
      className={`transition-colors duration-300 group-data-[open=true]:text-green-500 group-data-[open=false]:text-gray-700`}
    >
      <title>Lock</title>
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={`origin-[17px_11px] transition-transform duration-300 ease-out translate-y-0.5 group-data-[open=true]:rotate-y-180 group-data-[open=true]:origin-[15px_11px] in-[.unlock-exit]:rotate-y-180 in-[.unlock-exit]:origin-[15px_11px]`}
      />
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}
