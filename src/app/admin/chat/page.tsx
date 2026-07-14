// src/app/admin/chat/page.tsx
"use client";
import { DashboardProvider } from "@/components/tracker/DashboardContext";
import ChatApp from "@/components/chat/ChatApp";

export default function ChatPage() {
  return (
    <DashboardProvider embedded>
      <ChatApp />
    </DashboardProvider>
  );
}
