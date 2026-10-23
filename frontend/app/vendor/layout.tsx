import React from 'react';

export default function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-full flex-1 flex flex-col bg-[#f0ebf8]">
      {children}
    </div>
  );
}
