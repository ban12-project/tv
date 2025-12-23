"use client";

import { useState } from "react";
import Link from "@/components/link";

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
