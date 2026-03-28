"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavLink, useLocation } from "react-router-dom";

export function NavDocuments({
  items,
  label = "Reports and Analytics",
}) {
  useSidebar()
  const { pathname } = useLocation()

  if (!items?.length) return null

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild isActive={pathname === item.url || item.items?.some((subItem) => pathname === subItem.url)}>
              <NavLink to={item.url} end={!item.items?.length}>
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            </SidebarMenuButton>
            {item.items?.length ? (
              <SidebarMenuSub>
                {item.items.map((subItem) => (
                  <SidebarMenuSubItem key={subItem.name}>
                    <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                      <NavLink to={subItem.url}>{subItem.name}</NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
