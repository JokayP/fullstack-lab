export function ProductArtwork({ name }: { name: string }) {
  const kind = name.toLowerCase();
  return (
    <svg viewBox="0 0 300 200" aria-hidden="true" className="h-full w-full">
      <ellipse cx="150" cy="172" rx="72" ry="10" fill="#203e3610" />
      {kind.includes('pencil') || kind.includes('pen') ? (
        <g transform="rotate(28 150 100)">
          <path d="M135 35h30v120l-15 28-15-28Z" fill="#d2a15a" />
          <path d="M145 35h10v120h-10Z" fill="#f7dca5" />
          <path d="m135 155 15 28 15-28Z" fill="#e9d6b6" />
          <path d="m145 174 5 9 5-9Z" fill="#304a40" />
          <rect x="135" y="18" width="30" height="23" rx="7" fill="#c98272" />
          <path d="M135 37h30v9h-30Z" fill="#c2c8be" />
        </g>
      ) : kind.includes('bag') || kind.includes('backpack') ? (
        <g>
          <path d="M132 45V33a18 18 0 0 1 36 0v12" fill="none" stroke="#39584a" strokeWidth="8" />
          <rect x="96" y="40" width="108" height="131" rx="32" fill="#79917c" />
          <path d="M105 79h90" stroke="#b1c0a3" strokeWidth="3" />
          <rect x="111" y="104" width="78" height="53" rx="12" fill="#54735c" />
          <path d="M119 119h62" stroke="#b1c0a3" strokeWidth="3" />
          <rect x="141" y="57" width="18" height="12" rx="2" fill="#e9d7b3" />
        </g>
      ) : kind.includes('book') || kind.includes('notebook') ? (
        <g transform="rotate(-9 150 100)">
          <rect x="98" y="28" width="110" height="143" rx="6" fill="#b3b8aa" />
          <rect x="94" y="24" width="110" height="143" rx="6" fill="#385e4f" />
          <path d="M108 24v143" stroke="#1f4235" strokeWidth="7" />
          <path d="M193 25v140" stroke="#d0aa68" strokeWidth="5" />
          <rect x="125" y="62" width="53" height="39" rx="2" fill="#f2ead7" />
          <path d="M134 76h35m-31 10h27" stroke="#a6a38d" strokeWidth="2" />
          <path d="M111 164h80" stroke="#e8e3d3" strokeWidth="4" />
        </g>
      ) : (
        <g>
          <path d="m150 38 65 30-65 31-65-31Z" fill="#d5b88a" />
          <path d="M85 68v80l65 32V99Z" fill="#b79665" />
          <path d="M150 99v81l65-32V68Z" fill="#c4a674" />
          <path d="m115 54 65 31v33l-13 6V91l-65-30Z" fill="#ede2c9" />
        </g>
      )}
    </svg>
  );
}
