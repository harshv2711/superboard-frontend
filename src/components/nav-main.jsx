import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { NavLink, useLocation } from "react-router-dom";

export function NavMain({
  items
}) {
  const { pathname } = useLocation()
  const normalizedPath = pathname === "/account-planning" ? "/account-planing" : pathname

  const isItemActive = (item) => {
    if (item.items?.some((subItem) => normalizedPath === subItem.url)) {
      return true;
    }
    if (item.url === "/account-planing") {
      return normalizedPath.startsWith("/account-planing");
    }
    if (item.url === "/art-director") {
      return normalizedPath.startsWith("/art-director");
    }
    if (item.url === "/designer") {
      return normalizedPath.startsWith("/designer");
    }
    return normalizedPath === item.url;
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isItemActive(item)}>
                <NavLink to={item.url} end={!item.items?.length}>
                  {item.icon}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
              {item.items?.length ? (
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={normalizedPath === subItem.url}>
                        <NavLink to={subItem.url}>{subItem.title}</NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
