import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { superboardApi } from "@/api/superboardApi";
import { EllipsisVerticalIcon, CircleUserRoundIcon, LogOutIcon } from "lucide-react"
import { useNavigate } from "react-router-dom";

function formatRole(role) {
  if (!role) return "";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPersonName(value) {
  if (!value) return "User";
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function NavUser({
  user
}) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const displayFirstName = formatPersonName(user?.firstName?.trim() || user?.name || "User");
  const displayRole = formatRole(user?.role);
  const displayEmail = user?.email || "";

  async function handleLogout() {
    try {
      await superboardApi.auth.logout();
    } catch {
      superboardApi.auth.clearToken();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="h-auto min-h-16 items-start pr-12 py-3">
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayFirstName}</span>
            <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
            <span className="pr-2 text-xs leading-5 text-muted-foreground break-all">{displayEmail}</span>
          </div>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open user menu"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <EllipsisVerticalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayFirstName}</span>
                  <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
                  <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <CircleUserRoundIcon />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
