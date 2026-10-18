import type { IconName } from "../components/icon";
import type { ProfileSection } from "../profile/profile-controls";
import { parseDay } from "../calendar/dates.ts";

/** The tab bar, in order. */
export const trackTabs = [
  { name: "index", path: "/", title: "Home", icon: "house" },
  { name: "food", path: "/food", title: "Food", icon: "utensils" },
  { name: "exercise", path: "/exercise", title: "Exercise", icon: "dumbbell" },
  { name: "settings", path: "/settings", title: "Settings", icon: "gear" },
] as const satisfies readonly { name: string; path: string; title: string; icon: IconName }[];

export type TabPath = (typeof trackTabs)[number]["path"];

/**
 * The Personal journal is a hidden tab after the bar's tabs: the avatar menu opens
 * it. Being last and hidden with `initialRoute` Back, native Back from any tab returns
 * Home and never selects it.
 */
export const journalTab = { name: "profile", path: "/profile" } as const;

export const tabNavigator = { initialRouteName: "index", backBehavior: "initialRoute" } as const;

/** Route names in the order the tab navigator declares them. */
export const tabRouteNames = [...trackTabs.map((tab) => tab.name), journalTab.name];

export function isJournal(path: string): boolean {
  return path === journalTab.path;
}

/** The page name the header shows in place of the Selected day and its calendar. */
export function headerPage(path: string): "Profile" | "Settings" | null {
  if (isJournal(path)) return "Profile";
  return path === "/settings" ? "Settings" : null;
}

/** The tab the Personal journal returns to: the last bar tab shown before it, else Home. */
export function originatingTab(previous: TabPath, path: string): TabPath {
  return trackTabs.find((tab) => tab.path === path)?.path ?? previous;
}

export type HeaderPopover = "calendar" | "profile" | null;

/**
 * After a route change the profile menu closes. The calendar stays open across day
 * screens and stays open but hidden on Settings, so it reappears with the same day;
 * the Personal journal closes it so Back can leave the journal.
 */
export function popoverAfterNavigation(previous: HeaderPopover, path: string): HeaderPopover {
  return previous === "profile" || isJournal(path) ? null : previous;
}

/**
 * Android Back on the Personal journal returns to its originating tab once no header
 * popover is open (an open popover closes first). Elsewhere the tab navigator decides.
 */
export function journalHandlesBack(path: string, popover: HeaderPopover): boolean {
  return isJournal(path) && !popover;
}

const journalSections: Record<Lowercase<ProfileSection>, ProfileSection> = {
  overview: "Overview",
  goals: "Goals",
  photos: "Photos",
};

/**
 * One-shot screen requests carried as route params (see useRouteRequest): the screen
 * that owns each param and the parser that turns its text into the requested value.
 * An invalid value is cleared without reaching the screen.
 */
const routeRequests = {
  /** Open the Saved workouts menu on a day. */
  workoutMenu: { pathname: "/exercise", parse: (value: string) => (isDay(value) ? value : null) },
  /** Open the Active workout's page by session id. */
  liveWorkout: { pathname: "/exercise", parse: (value: string) => value },
  /** Open Workout import with a source id. */
  workoutImport: { pathname: "/exercise", parse: (value: string) => value },
  /** Open a Personal journal section. */
  section: {
    pathname: "/profile",
    parse: (value: string): ProfileSection | null =>
      Object.hasOwn(journalSections, value)
        ? journalSections[value as Lowercase<ProfileSection>]
        : null,
  },
} as const;

export type RouteRequestName = keyof typeof routeRequests;
export type RouteRequestValue<N extends RouteRequestName> = NonNullable<
  ReturnType<(typeof routeRequests)[N]["parse"]>
>;

function isDay(value: string): boolean {
  try {
    parseDay(value);
    return true;
  } catch {
    return false;
  }
}

/** The route that asks its screen for `value`, for `router.navigate` or `href`. */
export function routeRequest<N extends RouteRequestName>(name: N, value: RouteRequestValue<N>) {
  const { pathname } = routeRequests[name];
  const param = name === "section" ? value.toLowerCase() : value;
  return { pathname, params: { [name]: param } } as {
    pathname: (typeof routeRequests)[N]["pathname"];
    params: Record<N, string>;
  };
}

export function parseRouteRequest<N extends RouteRequestName>(
  name: N,
  value: string,
): RouteRequestValue<N> | null {
  return routeRequests[name].parse(value) as RouteRequestValue<N> | null;
}
