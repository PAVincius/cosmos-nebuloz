"use client";

import { logLogout } from "@repo/auth/auth-events";
import { authClient } from "@repo/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

type UserButtonProps = {
  name: string;
  email: string;
  avatar?: string | null;
};

export const UserButton = ({ name, email, avatar }: UserButtonProps) => {
  const router = useRouter();

  const handleSignOut = async () => {
    await logLogout();
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          size="lg"
        >
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 font-semibold text-primary text-xs">
            {avatar ? (
              <img className="size-full object-cover" src={avatar} />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{name}</span>
            <span className="truncate text-muted-foreground text-xs">
              {email}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-semibold text-primary text-xs">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-muted-foreground text-xs">
                {email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" disabled>
          <UserIcon className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={handleSignOut}
        >
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
