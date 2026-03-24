import { superboardApi } from "@/api/superboardApi";
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ClipboardListIcon, FolderKanbanIcon, HomeIcon, ListIcon, PaletteIcon, SearchIcon, Settings2Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react";

const data = {
  navMain: [
    {
      title: "Home",
      url: "/account-planing",
      icon: (
        <HomeIcon />
      ),
    },
    {
      title: "Account & Planing",
      url: "/account-planing/clients",
      icon: (
        <FolderKanbanIcon />
      ),
      items: [
        {
          title: "Daily Task",
          url: "/account-planing/daily-task",
        },
        {
          title: "Task Manager",
          url: "/account-planing/clients-work",
        },
        {
          title: "Client Directory",
          url: "/account-planing/clients",
        },
        {
          title: "Type Of Work",
          url: "/account-planing/type-of-work",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon />
      ),
    },
    {
      title: "Sections",
      url: "#",
      icon: (
        <ListIcon />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon />
      ),
    },
  ],
  documents: [
    {
      name: "Deliverables Tracker",
      url: "/reports/deliverables-tracker",
      icon: (
        <ClipboardListIcon />
      ),
    },
    {
      name: "Designer KPI",
      url: "/reports/designer-kpi",
      icon: (
        <ClipboardListIcon />
      ),
    },
    {
      name: "Brand KPI",
      url: "/reports/brand-kpi",
      icon: (
        <ClipboardListIcon />
      ),
    },
  ],
}

function getNavMainForRole(role) {
  if (role === "superuser") return data.navMain;
  if (role === "account_planner") {
    return data.navMain
      .filter((item) => item.url === "/account-planing" || item.title === "Account & Planing")
      .map((item) => ({
        ...item,
        items: (item.items || []).filter((subItem) => subItem.url !== "/account-planing/type-of-work"),
      }));
  }
  if (role === "art_director") {
    return [
      {
        title: "Home",
        url: "/art-director",
        icon: <HomeIcon />,
      },
      {
        title: "Art Director",
        url: "/art-director/task-manager",
        icon: <PaletteIcon />,
        items: [
          {
            title: "Daily Task",
            url: "/art-director/daily-task",
          },
          {
            title: "Task Manager",
            url: "/art-director/task-manager",
          },
          {
            title: "Type Of Work",
            url: "/art-director/type-of-work",
          },
        ],
      },
    ].filter(Boolean);
  }
  if (role === "designer") {
    return [
      {
        title: "Home",
        url: "/designer",
        icon: <HomeIcon />,
      },
      {
        title: "Designer",
        url: "/designer/clients-work",
        icon: <PaletteIcon />,
        items: [
          {
            title: "Daily Task",
            url: "/designer/daily-task",
          },
          {
            title: "Task Manager",
            url: "/designer/clients-work",
          },
        ],
      },
    ];
  }
  return [];
}

export function AppSidebar({
  ...props
}) {
  const [user, setUser] = useState({
    firstName: "",
    name: "User",
    email: "",
    avatar: "/avatars/shadcn.jpg",
    role: "",
  });
  const navMainItems = useMemo(() => getNavMainForRole(user.role), [user.role]);
  const documentItems = useMemo(() => {
    if (user.role === "designer") return [];
    if (user.role === "account_planner") {
      return data.documents.filter(
        (item) => item.url !== "/reports/designer-kpi" && item.url !== "/reports/brand-kpi",
      );
    }
    if (user.role !== "superuser") {
      return data.documents.filter((item) => item.url !== "/reports/brand-kpi");
    }
    return data.documents;
  }, [user.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const me = await superboardApi.auth.me();
        if (cancelled || !me) return;
        const fullName = `${me.first_name || ""} ${me.last_name || ""}`.trim();
        setUser({
          firstName: me.first_name || "",
          name: fullName || me.username || me.email || "User",
          email: me.email || "",
          avatar: "/avatars/shadcn.jpg",
          role: me.role || "",
        });
      } catch {
        // Keep fallback user display if profile fetch fails.
      }
    }

    loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="#">
                <span className="brand-wordmark text-[18px] font-semibold leading-none">Superboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavDocuments items={documentItems} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
