"use client";

import Link from "next/link";
import { useState } from "react";

export default function HoverPrefetchLink({
  href,
  children,
  ...props
}: React.ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
      {...props}
    >
      {children}
    </Link>
  );
}
