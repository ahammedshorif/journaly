import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur md:justify-end md:px-8">
      <Logo className="md:hidden" />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
